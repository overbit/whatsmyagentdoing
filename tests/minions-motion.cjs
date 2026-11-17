'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const def = JSON.parse(fs.readFileSync(path.join(root, 'scenes/minions/manifest.json'), 'utf8'));

function fakeThree() {
  const vec = (x = 0, y = 0, z = 0) => ({
    x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; },
    setScalar(n) { this.x = this.y = this.z = n; return this; },
    clone() { return vec(this.x, this.y, this.z); },
    project() { return this; },
  });
  class Group {
    constructor() { this.children = []; this.position = vec(); this.scale = vec(1, 1, 1);
      this.rotation = { x: 0, y: 0, z: 0 }; this.visible = true; }
    add(...objects) { this.children.push(...objects); }
  }
  class Material {
    constructor(options) {
      Object.assign(this, options);
      this.color = { value: options.color, set(value) { this.value = value; } };
      this.emissive = { value: options.emissive, set(value) { this.value = value; } };
    }
  }
  class Mesh extends Group {
    constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
  }
  class Geometry { constructor(...args) { this.args = args; } }
  class Fake3D {
    build() {
      this.room = new Group();
      this.scene.add(this.room);
      for (const p of this.plan.scene?.props || []) this.buildSceneProp(p);
    }
    buildSceneProp() {}
    syncActors() {}
    actorFor() { return { ordinary: true }; }
    facing() { return 0; }
    surfaceAt() { return 0; }
    draw() { return true; }
  }
  const T = { Group, Mesh, MeshStandardMaterial: Material, MeshBasicMaterial: Material,
    BoxGeometry: Geometry, CylinderGeometry: Geometry, SphereGeometry: Geometry,
    ConeGeometry: Geometry };
  const source = fs.readFileSync(path.join(root, 'public/minions3d.js'), 'utf8')
    .replace('export function installMinions3D', 'function installMinions3D');
  new Function(source + '; return installMinions3D;')()(Fake3D, T);
  const office = (scene = def) => {
    const o = new Fake3D();
    o.plan = { scene, helper: scene?.helper };
    o.scene = new Group();
    o.people = new Map();
    o.actors = new Map();
    o.t = 0;
    o.helperWaiting = () => 0;
    o.stateOf = (p) => p.testState || { pose: 'stand', act: 'station' };
    o.build();
    return o;
  };
  return { office };
}

function fake2D() {
  const win = {};
  const browser = { window: win, Image: class {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/office.js'), 'utf8'), browser);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/minions2d.js'), 'utf8'), browser);
  const room = Object.create(win.MinionsOffice.prototype);
  room.lab = def;
  room.plan = room.buildPlan();
  room.t = 0;
  room.people = new Map();
  room.hit = [];
  room.hoverKey = null;
  room.cat = { x: 3, y: 7 };
  room.iso = (x, y, z = 0) => ({ x: x * 12 + y * 5, y: y * 8 - x * 4 - z * 28 });
  room.box = () => {};
  room.poly = () => {};
  room.roundRect = () => {};
  room.onWall = () => {};
  const trace = [];
  room.ctx = new Proxy({ save() {}, restore() {} }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => trace.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { room, trace };
}

test('the lab declares ambient machinery and drone, all inside its map', () => {
  for (const type of ['lab-console', 'tank', 'rocket', 'conveyor', 'drone', 'vent']) {
    assert.ok(def.props.some((p) => p.special === type), `missing ${type}`);
  }
  for (const p of def.props) {
    assert.ok(p.x >= 0 && p.y >= 0 && p.x <= def.W && p.y <= def.D);
  }
});

test('3D machinery animates every frame without any live sessions', () => {
  const { office } = fakeThree();
  const o = office();
  assert.ok(o.labFx);
  assert.equal(o.labFx.consoles.length, def.stations.length);
  assert.equal(o.labFx.tanks.length, 2);
  assert.ok(o.labFx.drones.length && o.labFx.conveyors.length && o.labFx.vents.length);
  const bubbles = o.labFx.tanks[0].bubbles;
  const drone = o.labFx.drones[0].obj;
  const firstBubble = bubbles[0].position.y;
  const firstDroneX = drone.position.x;
  const firstBananaX = o.labFx.conveyors[0].bananas[0].position.x;
  o.t = 2700; o.syncActors(0.016);
  assert.notEqual(bubbles[0].position.y, firstBubble, 'tank bubbles float');
  assert.notEqual(drone.position.x, firstDroneX, 'drone patrols');
  assert.notEqual(o.labFx.conveyors[0].bananas[0].position.x, firstBananaX, 'conveyor runs');
  const newDroneX = drone.position.x;
  o.t = 4600; o.syncActors(0.016);
  assert.notEqual(drone.position.x, newDroneX, 'drone keeps patrolling');
});

test('3D console indicators react to session status and release the workstation', () => {
  const { office } = fakeThree();
  const o = office();
  const desk = def.stations[0];
  const consoleFx = o.labFx.consoles[0];
  const worker = { key: 'codex:one', mode: 'work', desk, helpSpot: null,
    s: { status: 'typing' } };
  o.people.set(worker.key, worker);
  o.t = 1000; o.syncActors(0.016);
  assert.equal(consoleFx.status, 'typing');
  assert.equal(consoleFx.screen.material.color.value, '#47e9b0');
  worker.s.status = 'tool';
  o.t = 2000; o.syncActors(0.016);
  assert.equal(consoleFx.status, 'tool');
  assert.equal(consoleFx.screen.material.color.value, '#ffbd55');
  worker.s.status = 'waiting'; worker.helpSpot = { x: 10, y: 10 };
  o.t = 2500; o.syncActors(0.016);
  assert.equal(consoleFx.status, null, 'absent worker no longer colors console');
});

test('render ticks reuse the same ambient meshes and reset on map changes', () => {
  const { office } = fakeThree();
  const o = office();
  const tank = o.labFx.tanks[0];
  const bubbles = tank.bubbles.slice();
  const initialGroups = o.room.children.length;
  for (let step = 0; step < 120; step++) {
    o.t = step * 83; o.syncActors(0.016);
  }
  assert.equal(o.room.children.length, initialGroups, 'no new meshes during animation');
  assert.deepEqual(tank.bubbles, bubbles, 'no per-frame bubble recreation');
  o.plan.scene = { id: 'pirate', props: [] };
  o.build();
  assert.equal(o.labFx, null, 'leaving the lab drops all lab animation registrations');
  o.t = 30000;
  assert.doesNotThrow(() => o.syncActors(0.016));
  o.plan.scene = def;
  o.build();
  assert.equal(o.labFx.tanks.length, 2, 'returning to lab does not duplicate registrations');
});

test('3D agents use independent poses for thinking, typing, waiting and celebration', () => {
  const { office } = fakeThree();
  const o = office();
  const p = { key: 'codex:one', h: 8, x: 2.6, y: 3.1, phase: 0.4,
    s: { status: 'thinking' }, testState: { pose: 'stand', act: 'station' } };
  o.people.set(p.key, p);
  // The fake shared renderer has no actor registry loop; create the mesh as
  // the real Office3D.syncActors() would before exercising Minions gestures.
  o.actorFor(p);
  o.t = 1000; o.syncActors(0.016);
  const actor = o.actors.get(p.key);
  assert.ok(actor?.features?.goggles, 'goggles can adjust independently');
  assert.ok(actor.features.pupils.length, 'eyes can glance around');
  const before = actor.features.pupils[0].position.x;
  o.t = 2400; o.syncActors(0.016);
  assert.notEqual(actor.features.pupils[0].position.x, before);
  p.s.status = 'typing';
  o.t = 3000; o.syncActors(0.016);
  const typingArm = actor.limbs.rightArm.rotation.x;
  p.s.status = 'waiting';
  o.t = 3400; o.syncActors(0.016);
  assert.notEqual(actor.limbs.rightArm.rotation.x, typingArm);
  p.s.status = 'done'; p.testState = { pose: 'stand', act: null };
  o.t = 3600; o.syncActors(0.016);
  assert.ok(actor.celebrateUntil > o.t);
  assert.ok(actor.limbs.leftArm.rotation.z !== 0, 'done triggers a celebration');
  o.t = 6600; o.syncActors(0.016);
  assert.ok(actor.celebrateUntil <= o.t, 'celebration ends');
});

test('2D lab ambient machinery changes between frames without agents', () => {
  const { room, trace } = fake2D();
  const types = ['tank', 'conveyor', 'drone', 'vent', 'rocket'];
  for (const type of types) {
    const p = def.props.find((item) => item.special === type);
    assert.ok(p, `no 2D prop of type ${type}`);
    trace.length = 0; room.t = 900; room.drawLabProp(p);
    const before = JSON.stringify(trace);
    let changed = false;
    for (const frame of [3600, 12000, 16000]) {
      trace.length = 0; room.t = frame; room.drawLabProp(p);
      if (JSON.stringify(trace) !== before) changed = true;
    }
    assert.ok(changed, `${type} should move visually over time`);
  }
});

test('2D Minions have animated idle and celebration states', () => {
  const { room, trace } = fake2D();
  const p = { key: 'codex:a', h: 2, phase: 0.3, x: 3, y: 4, s: { status: 'thinking' },
    testState: { pose: 'stand', act: 'think', sitZ: 0 } };
  room.stateOf = (person) => person.testState;
  room.t = 1100; room.person(p);
  const before = JSON.stringify(trace);
  trace.length = 0; room.t = 2300; room.person(p);
  assert.notEqual(JSON.stringify(trace), before, 'idle body and eyes animate');
  p.s.status = 'done'; p.testState.act = null;
  room.t = 2600; room.person(p);
  assert.ok(p.minionCelebrateUntil > room.t);
  room.t = 5700; room.person(p);
  assert.ok(p.minionCelebrateUntil <= room.t, 'celebration stops');
});

test('2D tool use and off-duty actions have distinct hand gestures', () => {
  const { room, trace } = fake2D();
  const p = { key: 'codex:a', h: 4, phase: 0, x: 2, y: 3,
    s: { status: 'thinking' }, testState: { pose: 'stand', act: 'station', sitZ: 0 } };
  room.stateOf = (actor) => actor.testState;
  const arms = (status, action = 'station') => {
    p.s.status = status; p.testState.act = action; trace.length = 0;
    room.t = 2200;
    room.person(p);
    return JSON.stringify(trace.filter((call) => call[0] === 'lineTo').slice(0, 2));
  };
  const thinking = arms('thinking');
  assert.notEqual(arms('typing'), thinking, 'typing moves the hands');
  assert.notEqual(arms('tool'), thinking, 'tool work moves the hands');
  assert.notEqual(arms('idle', 'read'), arms('idle', null), 'reading moves both hands');
});

test('3D off-duty reading and coffee actions animate hands independently of sessions', () => {
  const { office } = fakeThree();
  const o = office();
  const p = { key: 'codex:idle', h: 4, phase: 0, x: 2, y: 3,
    s: { status: 'idle' }, testState: { pose: 'stand', act: 'read' } };
  o.people.set(p.key, p);
  const a = o.actorFor(p);
  o.t = 1000; o.syncActors(0.016);
  assert.ok(a.limbs.leftArm.rotation.x < -0.35, 'reading holds something with left hand');
  assert.ok(a.limbs.rightArm.rotation.x < -0.35, 'reading holds something with right hand');
  p.testState.act = 'coffee'; o.syncActors(0.016);
  assert.ok(a.limbs.rightArm.rotation.x < -0.3, 'coffee lifts right hand');
});

test('animation remains isolated to Minions Lab', () => {
  const { office } = fakeThree();
  const pirate = office({ id: 'pirate', props: [] });
  assert.equal(pirate.labFx, null);
  pirate.t = 1000;
  assert.doesNotThrow(() => pirate.syncActors(0.016));
  assert.equal(pirate.actors.size, 0);
});
