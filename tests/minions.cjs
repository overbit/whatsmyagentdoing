// Lightweight theme regression checks; no browser, network, or agent data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('page loads both reskins and retains the renderer fallback', () => {
  const html = source('public/index.html');
  assert.match(html, /src="\/minions-2d\.js"/);
  assert.match(html, /import\('\/minions-3d\.js'\)/);
  assert.match(html, /mine = new window\.Office/);
  assert.match(html, /MINION/);
  assert.match(html, /prefers-reduced-motion/);
});

test('2D theme keeps shared simulation methods while overriding drawing only', () => {
  function Office() {}
  const simulation = () => true;
  const originalRoom = function () { this.roomPainted = true; };
  Office.prototype.stateOf = simulation;
  Office.prototype.drawRoom = originalRoom;
  const context = {
    window: { Office },
    document: {},
    console,
  };
  vm.runInNewContext(source('public/minions-2d.js'), context, { filename: 'minions-2d.js' });
  assert.equal(Office.prototype.stateOf, simulation);
  assert.notEqual(Office.prototype.drawRoom, originalRoom);
  assert.equal(typeof Office.prototype.person, 'function');
  assert.equal(typeof Office.prototype.drawCat, 'function');
  const mock = {
    pal: { dark: false }, plan: { scene: false, D: 15 },
    onWall(dir, pos, height, draw) {
      assert.equal(dir, 'x0');
      assert.equal(typeof draw, 'function');
    },
  };
  Office.prototype.drawRoom.call(mock);
  assert.equal(mock.roomPainted, true);
  assert.equal(mock.pal.wood1, '#ffec99');
  assert.equal(context.window.MINION_PALETTE.yellow, '#ffda38');

  const darkMock = { ...mock, pal: { dark: true } };
  Office.prototype.drawRoom.call(darkMock);
  assert.equal(darkMock.pal.wood1, '#4a4960');
});

test('3D theme layers over bundled renderer with original animation and interactions', () => {
  const module = source('public/minions-3d.js');
  assert.match(module, /extends BaseOffice3D/);
  assert.match(module, /super\.actorFor\(person\)/);
  assert.match(module, /super\.syncActors\(dt\)/);
  assert.match(module, /super\.build\(\)/);
  assert.match(module, /actor\.obj\.add\(root\)/);
  assert.match(module, /this\.room\.traverse/);
  assert.match(module, /st\.act|state\.act/);
});
