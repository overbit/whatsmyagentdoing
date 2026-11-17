'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { catalog, installed, sceneDir, install } = require('../src/scenes');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scenes/minions/manifest.json'), 'utf8'));

test('Minions laboratory is a bundled scene that works offline', () => {
  assert.equal(sceneDir('minions'), path.join(root, 'scenes/minions'));
  assert.ok(installed().some((s) => s.id === 'minions'));
  assert.equal(manifest.id, 'minions');
  assert.equal(manifest.version, 1);
  assert.equal(manifest.stations.length, 8);
  assert.ok(!catalog().some((s) => s.id === 'minions'), 'bundled lab does not require a remote download');
});

test('CLI scene installation reuses the bundled lab without downloading', async () => {
  const scene = await install('minions');
  assert.equal(scene.id, 'minions');
  assert.equal(scene.version, 1);
});

test('lab stations, roaming activities, and props fit the map', () => {
  const within = ({ x, y }) => x >= 0 && y >= 0 && x <= manifest.W && y <= manifest.D;
  assert.ok(within(manifest.spawn));
  assert.ok(manifest.stations.every(within));
  assert.ok(manifest.pois.every(within));
  assert.ok(manifest.props.every(within));
  assert.ok(manifest.props.some((p) => p.special === 'rocket'));
  assert.ok(manifest.props.some((p) => p.special === 'banana'));
  assert.ok(manifest.props.some((p) => p.special === 'lab-console'));
  assert.ok(manifest.props.some((p) => p.special === 'tank'));
  for (const station of manifest.stations) {
    assert.ok(manifest.walk.some(([x0, y0, x1, y1]) =>
      station.x >= x0 && station.x < x1 && station.y >= y0 && station.y < y1));
  }
});

test('2D and 3D scene integration keeps the base office and existing app theme', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const twoD = fs.readFileSync(path.join(root, 'public/minions2d.js'), 'utf8');
  const threeD = fs.readFileSync(path.join(root, 'public/minions3d.js'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'web/office3d.js'), 'utf8');
  const bundle = fs.readFileSync(path.join(root, 'public/office3d.js'), 'utf8');
  const pkg = require('../package.json');
  assert.match(html, /window\.MinionsOffice/);
  assert.match(html, /mid:minions/);
  assert.match(twoD, /class MinionsOffice extends window\.Office/);
  assert.match(threeD, /export function installMinions3D/);
  assert.match(source, /installMinions3D\(Office3D, THREE\)/);
  assert.match(bundle, /installMinions3D\(Cd,/);
  assert.ok(pkg.files.includes('scenes'), 'npm distribution includes the bundled lab');
  assert.match(pkg.scripts.build, /--external:\/minions3d\.js/);
});

function simulatedLab() {
  // Exercise the real session simulation without a browser or WebGL.
  const browser = { window: {}, Image: class {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/office.js'), 'utf8'), browser);
  const room = Object.create(browser.window.Office.prototype);
  room.plan = {
    fixed: true,
    helper: manifest.helper,
    door: manifest.spawn,
    desks: manifest.stations.map((s) => ({ x: s.x, y: s.y, side: 'n', seat: { x: s.x, y: s.y } })),
    grid: { path: (x0, y0, x, y) => [{ x, y }] },
  };
  room.people = new Map();
  room.deskOf = new Map();
  room.first = false;
  return room;
}

const agent = (key, status) => ({
  key, status, agent: 'codex', startedAt: 1, lastEventAt: 1,
});

test('a human helper is present at a fixed, accessible location for both renderers', () => {
  assert.ok(manifest.helper);
  const { x, y, spots } = manifest.helper;
  assert.ok(x >= 0 && x < manifest.W && y >= 0 && y < manifest.D);
  assert.equal(spots.length, manifest.stations.length);
  assert.ok(spots.every(({ x, y }) => x >= 0 && y >= 0 && x < manifest.W && y < manifest.D));
  assert.equal(new Set(spots.map((p) => `${p.x},${p.y}`)).size, spots.length);
  assert.ok(spots.every(({ x, y }) => !manifest.solid.some(([sx, sy, w, d]) =>
    x >= sx && x <= sx + w && y >= sy && y <= sy + d)));
  const twoD = fs.readFileSync(path.join(root, 'public/minions2d.js'), 'utf8');
  const threeD = fs.readFileSync(path.join(root, 'public/minions3d.js'), 'utf8');
  const plan3D = fs.readFileSync(path.join(root, 'web/office3d.js'), 'utf8');
  assert.match(twoD, /drawHuman/);
  assert.match(threeD, /buildHuman/);
  assert.match(plan3D, /helper: def\.helper/);
});

test('a waiting agent approaches the human and returns to its reserved workstation when resumed', () => {
  const room = simulatedLab();
  room.update([agent('codex:one', 'tool')]);
  const p = room.people.get('codex:one');
  const station = room.plan.desks[room.deskOf.get('codex:one')];
  assert.equal(p.helpSpot, null);
  assert.deepEqual({ ...p.path[0] }, station.seat);
  p.x = station.seat.x; p.y = station.seat.y; p.path = [];

  room.update([agent('codex:one', 'waiting')]);
  assert.ok(p.helpSpot, 'waiting agent has been assigned a visitor position');
  assert.ok(room.plan.helper.spots.includes(p.helpSpot));
  assert.deepEqual({ ...p.path.at(-1) }, p.helpSpot);
  assert.equal(p.desk, station, 'the working desk remains reserved');

  const pathToHuman = p.path;
  room.update([agent('codex:one', 'waiting')]);
  assert.equal(p.path, pathToHuman, 'updates do not restart the walk');

  room.update([agent('codex:one', 'typing')]);
  assert.equal(p.helpSpot, null);
  assert.deepEqual({ ...p.path.at(-1) }, station.seat);
  assert.equal(room.people.size, 1, 'the helper is not an artificial agent session');
});

test('simultaneous waiting agents receive separate visitor positions and keep them stable', () => {
  const room = simulatedLab();
  const first = agent('codex:first', 'waiting');
  const second = agent('codex:second', 'waiting');
  room.update([first, second]);
  const one = room.people.get(first.key);
  const two = room.people.get(second.key);
  assert.notEqual(one.helpSpot, two.helpSpot);
  const initialOne = one.helpSpot;
  const initialTwo = two.helpSpot;

  room.update([second, first]);
  assert.equal(one.helpSpot, initialOne);
  assert.equal(two.helpSpot, initialTwo);
  room.update([agent(first.key, 'typing'), second]);
  assert.equal(one.helpSpot, null);
  assert.ok(two.helpSpot);
});
