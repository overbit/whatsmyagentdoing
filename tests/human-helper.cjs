'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const browser = { window: {}, Image: class {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/office.js'), 'utf8'), browser);
const { Office, OfficeGrid, OfficeHelper } = browser.window;

function builtInOffice(n = 8) {
  const office = Object.create(Office.prototype);
  office.pal = { deskTop: '#bb9977', chair: '#444444', counter: '#ffffff', counterL: '#bbbbbb', counterR: '#aaaaaa' };
  office.plan = office.buildPlan(n);
  office.people = new Map();
  office.deskOf = new Map();
  office.first = false;
  return office;
}

function islandScene() {
  // Two separate islands: all workstations are on the right. The helper
  // must not appear on an arbitrary free tile of the wrong island.
  const W = 20, D = 12, grid = new OfficeGrid(W, D);
  grid.cost.fill(1);
  for (const [x0, y0, x1, y1] of [[1, 1, 6, 10], [11, 1, 19, 11]]) {
    for (let j = Math.floor(y0 * grid.res); j < Math.ceil(y1 * grid.res); j++) {
      for (let i = Math.floor(x0 * grid.res); i < Math.ceil(x1 * grid.res); i++) {
        grid.cost[j * grid.cw + i] = 0;
      }
    }
  }
  grid.block(14, 6, 1.3, 1.3);
  const desks = [{seat:{x:13,y:3}}, {seat:{x:16,y:4}}, {seat:{x:16,y:8}}];
  return { W, D, grid, desks, pois: [{x:13,y:8}], door:{x:12,y:10} };
}

const agent = (key, status) => ({ key, agent: 'codex', status, startedAt: 1, lastEventAt: 1 });

test('built-in office generates a human helper and clear visitor places as it grows', () => {
  for (const n of [0, 4, 8, 20]) {
    const office = builtInOffice(n);
    const { helper, grid, W, D } = office.plan;
    assert.ok(helper, 'the normal office has a human supervisor');
    assert.ok(helper.x > 0 && helper.y > 0 && helper.x < W && helper.y < D);
    assert.equal(grid.blocked(helper.x, helper.y), false);
    assert.ok(helper.spots.length >= Math.min(8, office.plan.desks.length),
      'the helper can handle a normal team without overlapping visitor spots');
    assert.equal(new Set(helper.spots.map((p) => `${p.x},${p.y}`)).size, helper.spots.length);
    assert.ok(helper.spots.every((p) => !grid.blocked(p.x, p.y)));
  }
});

test('other 3D map scenes automatically place helper on accessible work-area land', () => {
  assert.equal(typeof OfficeHelper, 'function');
  const plan = islandScene();
  const helper = OfficeHelper(plan);
  assert.ok(helper.x >= 11 && helper.x < 19, 'human is on the work island, not the other island');
  assert.ok(helper.spots.length >= 3);
  assert.ok(helper.spots.every((spot) => spot.x >= 11 && spot.x < 19 && !plan.grid.blocked(spot.x, spot.y)));
  assert.ok(helper.spots.every((spot) => Math.hypot(spot.x-helper.x, spot.y-helper.y) >= 0.65));
  assert.ok(!plan.grid.blocked(helper.x, helper.y));
});

test('waiting agents visit the human and return to their assigned desks in the normal office', () => {
  const office = builtInOffice(8);
  office.update([agent('codex:a', 'tool'), agent('codex:b', 'tool')]);
  const a = office.people.get('codex:a'), b = office.people.get('codex:b');
  const deskA = a.desk, deskB = b.desk;
  a.x = deskA.seat.x; a.y = deskA.seat.y; a.path = [];
  b.x = deskB.seat.x; b.y = deskB.seat.y; b.path = [];
  office.update([agent('codex:a', 'waiting'), agent('codex:b', 'waiting')]);
  assert.ok(a.helpSpot && b.helpSpot);
  assert.notEqual(a.helpSpot, b.helpSpot);
  assert.deepEqual({...a.path.at(-1)}, {...a.helpSpot});
  const stablePath = a.path;
  office.update([agent('codex:b', 'waiting'), agent('codex:a', 'waiting')]);
  assert.equal(a.path, stablePath, 'unchanged statuses do not restart walks');
  office.update([agent('codex:a', 'thinking'), agent('codex:b', 'waiting')]);
  assert.equal(a.helpSpot, null);
  assert.equal(a.desk, deskA);
  assert.equal(b.desk, deskB);
  assert.deepEqual({...a.path.at(-1)}, {...deskA.seat});
});


test('human help location is clear without a floor platform', () => {
  for (const n of [0, 8, 20]) {
    const office = builtInOffice(n);
    const { helper, grid } = office.plan;
    assert.equal('stageRadius' in helper, false, 'no floor platform metadata');
    for (const [dx, dy] of [[0, 0], [0.32, 0], [-0.32, 0], [0, 0.32], [0, -0.32]]) {
      assert.equal(grid.blocked(helper.x + dx, helper.y + dy), false,
        'human stands away from solid furniture');
    }
    assert.ok(helper.spots.every((p) => Math.hypot(p.x - helper.x, p.y - helper.y) >= 0.8),
      'queue spots remain separated from the human');
  }
});

test('shared 2D human retains overhead badge without circular floor aura', () => {
  const office = builtInOffice();
  const labels = [];
  office.t = 1000;
  office.cw = 800;
  office.ch = 600;
  office.inset = () => 0;
  office.ctx = new Proxy({ save() {}, restore() {}, fillText(s) { labels.push(s); },
    beginPath() {}, arc() {}, fill() {}, stroke() {} }, {
    get(target, name) { return name in target ? target[name] : () => {}; },
    set(target, name, value) { target[name] = value; return true; },
  });
  assert.equal(typeof office.drawHelperPad, 'undefined', 'no 2D floor aura renderer');
  office.roundRect = () => {};
  office.drawHelperBadge(140, 80, 0);
  assert.ok(labels.includes('HUMAN'));
  assert.ok(labels.includes('HELP STATION'));
  labels.length = 0;
  office.drawHelperBadge(140, 80, 2);
  assert.ok(labels.some((s) => /2.*WAITING/.test(s)), 'active input requests are readable');
});

test('3D keeps the help badge but no circular help station', () => {
  const mod = fs.readFileSync(path.join(root, 'public/minions3d.js'), 'utf8');
  assert.equal(mod.includes('function buildHelpStation'), false);
  assert.equal(mod.includes('this.humanHelper.station'), false);
  assert.match(mod, /this\.drawHelperBadge/);
});


test('3D human stands directly on the scene floor and waves when needed', () => {
  const source = fs.readFileSync(path.join(root, 'public/minions3d.js'), 'utf8')
    .replace('export function installMinions3D', 'function installMinions3D');
  const vector = (x = 0, y = 0, z = 0) => ({
    x, y, z,
    set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; },
    setScalar(n) { this.x = this.y = this.z = n; return this; },
    clone() { return vector(this.x, this.y, this.z); },
    project() { this.x /= 20; this.y /= 20; this.z = 0.2; return this; },
  });
  class Group {
    constructor() { this.children = []; this.position = vector(); this.scale = vector(1, 1, 1);
      this.rotation = { x: 0, y: 0, z: 0 }; }
    add(...objects) { this.children.push(...objects); }
  }
  class Mesh extends Group {
    constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
  }
  class Geometry { constructor(...args) { this.args = args; } }
  class Material { constructor(opts) { Object.assign(this, opts); } }
  class Fake3D {
    build() { this.room = new Group(); this.scene.add(this.room); }
    surfaceAt() { return 0.32; }
    facing() { return 0; }
    draw() { return 'drawn'; }
    syncActors() {}
  }
  const T = { Group, Mesh, MeshStandardMaterial: Material, MeshBasicMaterial: Material,
    BoxGeometry: Geometry, CylinderGeometry: Geometry, SphereGeometry: Geometry,
    ConeGeometry: Geometry };
  new Function(source + '; return installMinions3D;')()(Fake3D, T);
  for (const scene of [null, { id: 'pirate' }, { id: 'minions' }]) {
    const office = Object.create(Fake3D.prototype);
    office.plan = { scene, helper: { x: 5, y: 6 } };
    office.scene = new Group();
    office.people = new Map();
    office.actors = new Map();
    office.t = 1300;
    office.cw = 900;
    office.ch = 700;
    office.dpr = 1;
    office.camera = {};
    office.ctx = { save() {}, restore() {}, setTransform() {} };
    office.helperWaiting = () => office.people.size;
    office.drawHelperBadge = (_x, _y, n) => { office.badgeWaiting = n; };
    office.build();
    assert.ok(office.humanHelper?.obj, 'human remains visible');
    assert.equal(office.room.children.length, 1, 'no extra floor platform');
    assert.equal('station' in office.humanHelper, false);
    assert.equal(office.humanHelper.obj.position.y, scene ? 0.32 : 0,
      'human stands on the unmodified floor');
    office.people.set('agent', { helpSpot: { x: 5.8, y: 6 }, s: { status: 'waiting' } });
    office.syncActors(0.016);
    assert.ok(office.humanHelper.arm.rotation.z > 0, 'human still signals for attention');
    office.draw();
    assert.equal(office.badgeWaiting, 1);
    office.people.clear();
    office.syncActors(0.016);
    assert.equal(office.humanHelper.arm.rotation.z, 0, 'human stops waving when idle');
  }
});

test('a session already waiting when the dashboard opens visibly walks to the human', () => {
  const office = builtInOffice(4);
  office.first = true;
  office.update([agent('codex:on-load', 'waiting')]);
  const person = office.people.get('codex:on-load');
  assert.ok(person.helpSpot);
  assert.equal(person.placeOnArrive, false);
  assert.deepEqual({ x: person.x, y: person.y }, { ...person.desk.seat },
    'initial position stays at the assigned workstation');
  assert.deepEqual({ ...person.path.at(-1) }, { ...person.helpSpot },
    'initial waiting state plans a walk to the human');
});

test('2D and 3D renderers draw the same human and default scenes share helper wiring', () => {
  const twod = fs.readFileSync(path.join(root, 'public/minions2d.js'), 'utf8');
  const threed = fs.readFileSync(path.join(root, 'public/minions3d.js'), 'utf8');
  const src3d = fs.readFileSync(path.join(root, 'web/office3d.js'), 'utf8');
  const bundle = fs.readFileSync(path.join(root, 'public/office3d.js'), 'utf8');
  assert.match(fs.readFileSync(path.join(root, 'public/office.js'), 'utf8'), /drawHuman\(\)/);
  assert.match(threed, /Office3D\.prototype\.build = function/);
  assert.match(threed, /this\.humanHelper/);
  assert.match(src3d, /OfficeHelper/);
  assert.match(bundle, /OfficeHelper/);
  assert.ok(Office.prototype.drawHuman);
  assert.equal(typeof Office.prototype.drawHuman, 'function');
  assert.equal(typeof twod, 'string');
});
