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
