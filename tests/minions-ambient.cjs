'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scenes/minions/manifest.json'), 'utf8'));

function setup() {
  const browser = { window: {}, Image: class {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/office.js'), 'utf8'), browser);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/minions-ambient.js'), 'utf8'), browser);
  const grid = new browser.window.OfficeGrid(manifest.W, manifest.D);
  const R = grid.res;
  grid.cost.fill(1);
  for (const [x0, y0, x1, y1] of manifest.walk) {
    for (let j = Math.floor(y0 * R); j < Math.ceil(y1 * R); j++)
      for (let i = Math.floor(x0 * R); i < Math.ceil(x1 * R); i++)
        if (i >= 0 && j >= 0 && i < grid.cw && j < grid.ch)
          grid.cost[j * grid.cw + i] = 0;
  }
  for (const [x, y, w, h] of manifest.solid) grid.block(x, y, w, h);
  return { grid, ambient: browser.window.MinionsAmbient };
}

test('background Minions are separate from real sessions and have distinct routes', () => {
  const { grid, ambient } = setup();
  const extras = ambient.create(manifest, grid);
  assert.equal(extras.length, 3);
  assert.equal(new Set(extras.map((p) => p.key)).size, extras.length);
  assert.ok(extras.every((p) => p.ambient && p.mode === 'wander' && p.s.status === 'idle'));
  assert.ok(extras.every((p) => !grid.blocked(p.x, p.y)));
  assert.ok(extras.every((p) => p.route.length >= 3));
  assert.ok(extras.every((p) => !manifest.stations.some((d) =>
    Math.hypot(d.x - p.x, d.y - p.y) < 0.5)));
});

test('background Minions walk on clear paths and periodically eat bananas', () => {
  const { grid, ambient } = setup();
  const extras = ambient.create(manifest, grid);
  const first = extras[0];
  const initial = { x: first.x, y: first.y };
  let walked = false, ate = false, seenOther = false;
  for (let frame = 0; frame < 2400; frame++) {
    ambient.tick(extras, grid, 0.05);
    if (Math.hypot(first.x - initial.x, first.y - initial.y) > 0.2) walked = true;
    if (first.act === 'eat-banana') {
      ate = true;
      assert.ok(first.actionProgress >= 0 && first.actionProgress <= 1);
    }
    if (extras.some((p) => p.act === 'inspect' || p.act === 'dance' || p.act === 'chat')) seenOther = true;
    for (const p of extras) {
      assert.ok(p.x >= 0 && p.x <= manifest.W && p.y >= 0 && p.y <= manifest.D);
      assert.equal(grid.blocked(p.x, p.y), false, 'NPC must not walk through furniture');
    }
  }
  assert.ok(walked, 'the Minions should roam the lab');
  assert.ok(ate, 'a Minion should reach a banana and eat it');
  assert.ok(seenOther, 'other idle activities should occur');
});

test('NPC activity routes are reproducible, bounded and reset with a new scene', () => {
  const { grid, ambient } = setup();
  const a = ambient.create(manifest, grid), b = ambient.create(manifest, grid);
  for (let i = 0; i < 500; i++) {
    ambient.tick(a, grid, 0.05);
    ambient.tick(b, grid, 0.05);
  }
  assert.deepEqual(a.map((p) => [p.x, p.y, p.act, p.target?.id]),
    b.map((p) => [p.x, p.y, p.act, p.target?.id]));
  const reset = ambient.create(manifest, grid);
  assert.ok(reset.every((p) => p.actionProgress === 0));
  assert.notDeepEqual(a.map((p) => p.x), reset.map((p) => p.x));
  assert.ok(a.every((p) => p.path.length < 250));
});

test('idle actions do not change agent counts or reserve real session POIs', () => {
  const { grid, ambient } = setup();
  const originalPois = manifest.pois.map((p) => ({ ...p }));
  const extras = ambient.create(manifest, grid);
  for (let i = 0; i < 250; i++) ambient.tick(extras, grid, 0.05);
  assert.deepEqual(manifest.pois, originalPois, 'real-session points of interest stay unchanged');
  assert.ok(extras.every((p) => p.key.startsWith('ambient:')));
  assert.ok(extras.every((p) => !('desk' in p) && !('helpSpot' in p)));
});

test('2D and 3D renderers consume the same ambient state without fake session actors', () => {
  const twoD = fs.readFileSync(path.join(root, 'public/minions2d.js'), 'utf8');
  const threeD = fs.readFileSync(path.join(root, 'public/minions3d.js'), 'utf8');
  assert.match(twoD, /MinionsAmbient\.tick/);
  assert.match(twoD, /drawAmbientMinion/);
  assert.match(threeD, /MinionsAmbient|ambientSystem/);
  assert.match(threeD, /ambientActors/);
  assert.match(threeD, /eat-banana/);
});

test('2D background characters are depth-sorted and never clickable session targets', () => {
  const browser = { window: {}, Image: class {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/office.js'), 'utf8'), browser);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/minions-ambient.js'), 'utf8'), browser);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/minions2d.js'), 'utf8'), browser);
  const room = Object.create(browser.window.MinionsOffice.prototype);
  room.lab = manifest;
  room.plan = room.buildPlan();
  room.people = new Map();
  room.deskOf = new Map();
  room.hit = [];
  room.hoverKey = null;
  room.cat = { x: 3, y: 6, path: [], until: 0 };
  room.moveCat = () => {};
  room.t = 0;
  room.iso = (x, y, z = 0) => ({ x: (x - y) * 12, y: (x + y) * 6 - z * 28 });
  room.poly = () => {};
  room.box = () => {};
  room.roundRect = () => {};
  room.onWall = () => {};
  const calls = [];
  room.ctx = new Proxy({}, {
    get(target, key) {
      return key in target ? target[key] : (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  for (let i = 0; i < 80; i++) { room.step(0.05); room.t += 50; }
  room.drawRoom();
  const items = room.plan.items.filter((item) => item.ambientNpc);
  assert.equal(items.length, 3);
  assert.ok(items.every((item) => Math.abs(item.depth - item.ambientNpc.x -
    item.ambientNpc.y - 0.01) < 0.001));
  items.forEach((item) => item.draw());
  assert.equal(room.hit.length, 0);
  assert.equal(room.people.size, 0, 'background Minions are not real sessions');
  const npc = room.plan.ambient[0];
  npc.path = []; npc.poi = { act: 'eat-banana' };
  npc.act = 'eat-banana'; npc.actionProgress = 0.5;
  calls.length = 0;
  room.drawAmbientMinion(npc);
  assert.ok(calls.some(([name]) => name === 'quadraticCurveTo'),
    '2D eating scene draws a curved, shrinking banana');
});

test('3D ambient Minions independently animate snacks and reset on map changes', () => {
  const { grid, ambient } = setup();
  const vec = () => ({ x: 0, y: 0, z: 0,
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
    setScalar(v) { this.x = this.y = this.z = v; return this; },
  });
  class Group {
    constructor() { this.children = []; this.position = vec(); this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = vec(); this.scale.setScalar(1); this.visible = true; }
    add(...children) { this.children.push(...children); }
  }
  class Mesh extends Group {
    constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
  }
  class Material {
    constructor(options) { Object.assign(this, options);
      this.color = { set() {} }; this.emissive = { set() {} }; }
  }
  class Geometry { constructor(...args) { this.args = args; } }
  class Fake3D {
    constructor() {
      this.plan = { scene: manifest, helper: manifest.helper, grid };
      this.scene = new Group();
      this.people = new Map();
      this.actors = new Map();
      this.t = 0;
    }
    build() {
      this.room = new Group(); this.scene.add(this.room);
      for (const prop of this.plan.scene.props) this.buildSceneProp(prop);
    }
    buildSceneProp() {}
    syncActors() {}
    actorFor() { throw new Error('not a real session'); }
    facing() { return 0; }
    surfaceAt() { return 0; }
  }
  const T = { Group, Mesh, MeshStandardMaterial: Material, MeshBasicMaterial: Material,
    BoxGeometry: Geometry, CylinderGeometry: Geometry, SphereGeometry: Geometry,
    ConeGeometry: Geometry };
  const source = fs.readFileSync(path.join(root, 'public/minions3d.js'), 'utf8')
    .replace('export function installMinions3D', 'function installMinions3D');
  new Function('window', 'Office3D', 'T',
    source + ';installMinions3D(Office3D,T);')({ MinionsAmbient: ambient }, Fake3D, T);
  const office = new Fake3D();
  office.build();
  assert.equal(office.ambientActors.length, 3);
  const actors = office.ambientActors;
  const before = actors.map((a) => ({ x: a.obj.position.x, y: a.obj.position.z }));
  let sawBanana = false;
  for (let i = 0; i < 2200; i++) {
    office.t = i * 50;
    office.syncActors(0.05);
    sawBanana ||= actors.some((a) => a.features.banana.visible);
  }
  assert.ok(sawBanana, 'the banana prop appears during eating');
  assert.ok(actors.every((a, i) => Math.hypot(a.obj.position.x - before[i].x,
    a.obj.position.z - before[i].y) > 0.1));
  assert.equal(office.actors.size, 0, 'no fake session actors created');
  office.plan.scene = { id: 'pirate', props: [] };
  office.build();
  assert.equal(office.ambientActors.length, 0);
  office.plan.scene = manifest;
  office.build();
  assert.equal(office.ambientActors.length, 3, 'scene rebuild replaces, not duplicates, extras');
});

test('all ambient assets remain served locally without external dependencies', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  assert.match(html, /<script src="\/minions-ambient\.js"><\/script>/);
  assert.match(server, /'\/minions-ambient\.js'/);
  assert.ok(!fs.readFileSync(path.join(root, 'public/minions-ambient.js'), 'utf8')
    .includes('fetch('), 'ambient simulation never requests network access');
});
