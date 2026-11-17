'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { catalog, installed, sceneDir } = require('../src/scenes');

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
