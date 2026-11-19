// A self-contained, dependency-free 2D laboratory scene. The dashboard chrome
// and the shared session simulation intentionally stay in Office.
(() => {
  'use strict';

  let pendingScene = null;
  const YELLOW = '#f8d63b';
  const BLUE = '#2a65a3';
  const INK = '#253648';

  function labPlan(def) {
    const grid = new window.OfficeGrid(def.W, def.D);
    const R = grid.res;
    grid.cost.fill(1);
    for (const [x0, y0, x1, y1] of def.walk) {
      for (let y = Math.floor(y0 * R); y < Math.ceil(y1 * R); y++) {
        for (let x = Math.floor(x0 * R); x < Math.ceil(x1 * R); x++) {
          if (x >= 0 && y >= 0 && x < grid.cw && y < grid.ch) grid.cost[y * grid.cw + x] = 0;
        }
      }
    }
    for (const [x, y, w, d] of def.solid || []) grid.block(x, y, w, d);
    const desks = def.stations.map((s) => ({
      x: s.x, y: s.y, side: 'n', pose: 'stand',
      seat: { x: s.x, y: s.y },
    }));
    const pois = def.pois.map((p) => ({
      ...p, face: 'front', sit: p.sit || 0, taken: null,
    }));
    const items = def.props
      .filter((p) => !['floor', 'wall', 'sign', 'glow', 'lamp'].includes(p.special))
      .map((p) => ({ depth: p.x + p.y - (p.special === 'lab-console' ? 0.25 : 0), draw: () => null, prop: p }));
    const ambient = window.MinionsAmbient.create(def, grid);
    for (const npc of ambient) items.push({ ambientNpc: npc, depth: npc.x + npc.y, draw: () => null });
    return {
      W: def.W, D: def.D, grid, items, ambient, props: def.props, desks, pois, door: def.spawn, helper: def.helper,
      fixed: true, noNap: true, windows: [], posters: [], pp: null, scene: def,
    };
  }

  class MinionsOffice extends window.Office {
    constructor(root, options = {}) {
      pendingScene = options.scene;
      super(root, options);
      this.lab = pendingScene;
      pendingScene = null;
    }

    buildPlan() {
      return labPlan(pendingScene || this.lab);
    }

    step(dt) {
      super.step(dt);
      window.MinionsAmbient.tick(this.plan.ambient, this.plan.grid, dt);
    }

    drawAmbientMinion(npc) {
      // Decorative NPCs render in the same depth-sorted world as agents, but
      // aren't real sessions, hover targets or status bubbles.
      this.person(npc);
    }

    // Drawing the scene ourselves keeps it fully offline and makes Medium as
    // recognisably different from the normal office as the new 3D map.
    drawRoom() {
      const { W, D } = this.plan;
      const P = (x, y, z = 0) => this.iso(x, y, z);
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < D; y++) {
          this.poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)],
            (x + y) % 2 ? '#c5d5dc' : '#d6e3e8');
        }
      }
      for (const x of [11.8, 12.35]) {
        this.poly([P(x, 6.0), P(x + 0.14, 6.0), P(x + 0.14, 11.2), P(x, 11.2)], '#efc52f');
      }
      this.poly([P(0, 0, 0), P(W, 0, 0), P(W, 0, 2.7), P(0, 0, 2.7)], '#416b7e');
      this.poly([P(0, 0, 0), P(0, D, 0), P(0, D, 2.7), P(0, 0, 2.7)], '#325768');
      this.poly([P(0, 0, 2.7), P(W, 0, 2.7), P(W, -0.15, 2.7),
        P(-0.15, -0.15, 2.7), P(-0.15, D, 2.7), P(0, D, 2.7)], '#78909a');
      for (const x of [1.6, 5.0, 9.2]) {
        this.poly([P(x, 0, 1.1), P(x + 2.2, 0, 1.1), P(x + 2.2, 0, 2.3), P(x, 0, 2.3)], '#9ed7e7', '#243f55');
        this.poly([P(x + 1.07, 0, 1.1), P(x + 1.13, 0, 1.1),
          P(x + 1.13, 0, 2.3), P(x + 1.07, 0, 2.3)], '#37576a');
      }
      this.poly([P(0, 2.1, 1), P(0, 4.3, 1), P(0, 4.3, 2.35), P(0, 2.1, 2.35)], '#9ed7e7', '#243f55');
      this.onWall('y0', 13.8, 2.35, (c) => {
        c.fillStyle = '#ffd93c'; c.font = '900 14px system-ui, sans-serif';
        c.textAlign = 'center'; c.fillText('GRU LABS', 0, 0);
      });
      this.onWall('x0', 6.9, 2.05, (c) => {
        c.fillStyle = '#ffd93c'; c.font = '800 10px system-ui, sans-serif';
        c.textAlign = 'center'; c.fillText('BANANA', 0, 0); c.fillText('RESEARCH', 0, 11);
      });
      for (const item of this.plan.items) {
        if (item.ambientNpc) {
          const npc = item.ambientNpc;
          item.depth = npc.x + npc.y + 0.01;
          item.draw = () => this.drawAmbientMinion(npc);
        } else {
          item.draw = () => this.drawLabProp(item.prop);
        }
      }
    }

    drawLabProp(p) {
      const c = this.ctx;
      const P = (x, y, z = 0) => this.iso(x, y, z);
      const t = this.t / 1000;
      // All decorative machines animate without requiring any agent sessions.
      if (p.special === 'conveyor') {
        const w = p.w || 2.5, h = p.h || 0.75, d = p.d || 0.7;
        this.box(p.x, p.y - d / 2, 0, w, d, h, '#6d8796', '#49667b', '#344d60');
        this.box(p.x, p.y - d / 2, h, w, d, 0.07, '#344758', '#1f3448', '#152e3b');
        for (let i = 0; i < 3; i++) {
          const x = p.x + 0.25 + (t * 0.35 + i * 0.76) % (w - 0.35);
          const q = P(x, p.y, h + 0.12);
          c.strokeStyle = '#b58219'; c.lineWidth = 6; c.lineCap = 'round';
          c.beginPath(); c.moveTo(q.x - 8, q.y); c.quadraticCurveTo(q.x, q.y + 10, q.x + 9, q.y - 2); c.stroke();
          c.strokeStyle = '#ffe34b'; c.lineWidth = 4.5; c.stroke();
        }
        return;
      }
      if (p.special === 'drone') {
        const x = p.x + Math.sin(t * 0.58) * (p.range || 1.5);
        const q = P(x, p.y, (p.height || 1.75) + Math.sin(t * 1.9) * 0.12);
        c.save(); c.translate(q.x, q.y);
        c.fillStyle = '#7898aa'; this.roundRect(-13, -4, 26, 9, 4, '#7898aa');
        c.fillStyle = '#55ebec'; c.beginPath(); c.arc(0, 2, 3.5, 0, Math.PI * 2); c.fill();
        for (const side of [-1, 1]) {
          c.strokeStyle = '#7f9baa'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(side * 11, -1); c.lineTo(side * 22, -6); c.stroke();
          const wing = 6 + 5 * Math.abs(Math.sin(t * 22));
          c.strokeStyle = '#d5f6f8'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(side * 22 - wing, -7); c.lineTo(side * 22 + wing, -7); c.stroke();
        }
        c.restore();
        return;
      }
      if (p.special === 'vent') {
        this.box(p.x - 0.25, p.y - 0.2, 0, 0.5, 0.4, 0.12, '#8fa7b3', '#617d8a', '#476272');
        for (let i = 0; i < 5; i++) {
          const age = (t * 0.4 + i * 0.19) % 1;
          const q = P(p.x + Math.sin(t * 1.1 + i * 2.2) * 0.12, p.y, 0.17 + age * 1.4);
          c.save(); c.globalAlpha = (1 - age) * 0.55;
          c.fillStyle = '#ecfaff';
          c.beginPath(); c.arc(q.x, q.y, 3 + age * 3, 0, Math.PI * 2); c.fill();
          c.restore();
        }
        return;
      }
      if (p.special === 'banana-bot') {
        const q = P(p.x + Math.sin(t * 0.46) * (p.range || 1), p.y + Math.cos(t * 0.46) * 0.18, 0);
        c.save(); c.translate(q.x, q.y);
        c.fillStyle = '#324c60';
        for (const side of [-1, 1]) { c.beginPath(); c.arc(side * 8, 0, 3.5, 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = '#ffe343'; c.lineWidth = 8; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-11, -14); c.quadraticCurveTo(2, 2, 12, -16); c.stroke();
        c.fillStyle = '#d9f6fb'; c.beginPath(); c.arc(1, -10, 2.6, 0, Math.PI * 2); c.fill();
        c.restore();
        return;
      }
      if (p.special === 'box') {
        this.box(p.x, p.y, 0, p.w, p.d, p.h, '#8fa6b2', p.color, '#456173');
        return;
      }
      if (p.special === 'lab-console') {
        const x = p.x, y = p.y;
        this.box(x - 0.53, y - 0.83, 0, 1.06, 0.47, 0.74, '#738f9d', '#486878', '#344f61');
        this.box(x - 0.38, y - 0.74, 0.74, 0.75, 0.13, 0.46, '#3e6575', '#263d50', '#1b3043');
        const screen = P(x, y - 0.65, 1.04);
        let status = null;
        for (const actor of this.people.values()) {
          if (actor.mode === 'work' && actor.desk && !actor.helpSpot &&
              actor.desk.x === x && actor.desk.y === y) {
            status = actor.s?.status; break;
          }
        }
        const signal = { thinking: '#7e97f8', tool: '#ffbd55',
          typing: '#4beaaf', waiting: '#ffe15e', error: '#ff766b' };
        c.fillStyle = signal[status] || '#3bd8dd';
        c.globalAlpha = 0.78 + Math.sin(t * (status ? 6 : 2) + x) * 0.18;
        c.fillRect(screen.x - 10, screen.y - 8, 21, 12);
        c.globalAlpha = 1;
        c.fillStyle = '#e0ffff';
        for (let i = 0; i < 3; i++) {
          const amp = status ? 4 : 2;
          c.fillRect(screen.x - 7 + i * 6, screen.y - 5 +
            Math.sin(t * (status ? 9 : 2.1) + i * 1.7) * amp, 3, 2);
        }
        const light = P(x, y - 0.35, 0.76);
        c.fillStyle = '#f2c83b'; c.fillRect(light.x - 6, light.y - 2, 12, 4);
        return;
      }
      if (p.special === 'tank') {
        const q = P(p.x, p.y, 0);
        const h = (p.h || 1.6) * 32;
        c.fillStyle = '#384d5e'; c.fillRect(q.x - 17, q.y - h, 34, h);
        c.fillStyle = p.liquid || '#9de975'; c.globalAlpha = 0.64;
        c.fillRect(q.x - 13, q.y - h + 12, 26, h - 20); c.globalAlpha = 1;
        c.fillStyle = '#d5e7eb';
        c.beginPath(); c.ellipse(q.x, q.y - h, 17, 6, 0, 0, 2 * Math.PI); c.fill();
        c.fillStyle = '#3c5767';
        c.beginPath(); c.ellipse(q.x, q.y, 18, 6, 0, 0, 2 * Math.PI); c.fill();
        for (let k = 0; k < 3; k++) {
          const yy = q.y - 12 - ((this.t / 28 + k * 19) % (h - 24));
          c.fillStyle = '#e2fff2'; c.beginPath(); c.arc(q.x + (k - 1) * 6, yy, 2, 0, 2 * Math.PI); c.fill();
        }
        return;
      }
      if (p.special === 'rocket') {
        const q = P(p.x, p.y, 0);
        c.fillStyle = '#275d86'; c.fillRect(q.x - 17, q.y - 52, 34, 48);
        c.fillStyle = '#e4eaed'; this.roundRect(q.x - 12, q.y - 73, 24, 67, 11, '#e4eaed');
        c.fillStyle = '#edbf2e';
        c.beginPath(); c.moveTo(q.x - 10, q.y - 64); c.lineTo(q.x, q.y - 88); c.lineTo(q.x + 10, q.y - 64); c.fill();
        c.fillStyle = '#4bb7da'; c.beginPath(); c.arc(q.x, q.y - 48, 7, 0, 2 * Math.PI); c.fill();
        c.fillStyle = '#2e648d';
        c.beginPath(); c.moveTo(q.x - 12, q.y - 28); c.lineTo(q.x - 22, q.y - 5); c.lineTo(q.x - 8, q.y - 11); c.fill();
        c.beginPath(); c.moveTo(q.x + 12, q.y - 28); c.lineTo(q.x + 22, q.y - 5); c.lineTo(q.x + 8, q.y - 11); c.fill();
        // Short, infrequent test firings keep the lab alive without noise.
        if ((t + p.y * 0.2) % 13 < 1.25) {
          const length = 12 + Math.sin(t * 22) * 4;
          c.fillStyle = '#ff9c35';
          c.beginPath(); c.moveTo(q.x - 7, q.y - 5);
          c.lineTo(q.x, q.y + length); c.lineTo(q.x + 7, q.y - 5); c.fill();
        }
        return;
      }
      if (p.special === 'banana') {
        const q = P(p.x, p.y, 0.72);
        c.strokeStyle = '#9c6818'; c.lineWidth = 9; c.lineCap = 'round';
        c.beginPath(); c.moveTo(q.x - 12, q.y + 3); c.quadraticCurveTo(q.x + 1, q.y + 17, q.x + 14, q.y - 2); c.stroke();
        c.strokeStyle = '#ffdc45'; c.lineWidth = 7; c.stroke();
        return;
      }
      if (p.special === 'pipe') {
        this.box(p.x, p.y, 1.9, p.w, 0.18, 0.15, '#a4b5be', '#5c7886', '#304e60');
      }
    }

    // Consoles are in the scene item list; do not draw the old office desks.
    desk() {}
    chair() {}
    pingPongBall() {}

    // The office cat becomes a small rolling banana robot.
    drawCat() {
      const q = this.iso(this.cat.x, this.cat.y);
      const c = this.ctx;
      c.save(); c.translate(q.x, q.y);
      c.fillStyle = '#2e4355';
      for (const x of [-7, 7]) { c.beginPath(); c.arc(x, -1, 3, 0, 2 * Math.PI); c.fill(); }
      c.strokeStyle = YELLOW; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-11, -12); c.quadraticCurveTo(2, 1, 12, -15); c.stroke();
      c.fillStyle = '#d6e9ef'; c.beginPath(); c.arc(2, -10, 2, 0, 2 * Math.PI); c.fill();
      c.restore();
    }

    person(p) {
      const c = this.ctx, t = this.t / 1000, st = this.stateOf(p);
      if (p.minionLastStatus !== p.s.status) {
        p.minionLastStatus = p.s.status;
        if (p.s.status === 'done') p.minionCelebrateUntil = this.t + 2400;
      }
      const walk = st.pose === 'walk';
      const celebrating = !walk && p.s.status === 'done' && p.minionCelebrateUntil > this.t;
      const step = walk ? Math.sin(t * 12 + p.phase) : 0;
      const bob = walk ? Math.abs(step) * 2 :
        celebrating ? Math.abs(Math.sin(t * 9)) * 3 : Math.sin(t * 1.8 + p.phase) * 1.1;
      const foot = this.iso(p.x, p.y);
      const b = this.iso(p.x, p.y, st.sitZ);
      const scale = p.s.subagent ? 0.8 : 1;
      let greeting = false;
      if (!walk && p.s.status === 'idle' && !st.act &&
          Math.sin(t * 0.58 + p.phase) > 0.93) {
        for (const other of this.people.values()) {
          if (other !== p && other.s?.status !== 'waiting' &&
              Math.hypot(other.x - p.x, other.y - p.y) < 2.2) {
            greeting = true;
            break;
          }
        }
      }
      const wave = st.act === 'wave' || celebrating || greeting;
      const eyes = p.h % 3 === 0 ? 1 : 2;
      const sleepy = p.s.status === 'idle';
      c.save();
      c.fillStyle = 'rgba(22,42,55,.22)';
      c.beginPath(); c.ellipse(foot.x, foot.y, 11, 4, 0, 0, 2 * Math.PI); c.fill();
      if (this.hoverKey === p.key) {
        c.strokeStyle = '#e8b932'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(foot.x, foot.y, 14, 7, 0, 0, 2 * Math.PI); c.stroke();
      }
      c.translate(b.x, b.y - bob);
      c.scale(scale, scale);
      // Boots and animated legs.
      c.fillStyle = '#252b35';
      c.fillRect(-8, -10 + step * 2, 7, 10); c.fillRect(2, -10 - step * 2, 7, 10);
      c.fillRect(-10, -3 + step * 2, 9, 4); c.fillRect(2, -3 - step * 2, 9, 4);
      // Arms and black gloves; waiting agents wave.
      c.strokeStyle = YELLOW; c.lineWidth = 6; c.lineCap = 'round';
      const scratch = !walk && p.s.status === 'thinking' && Math.sin(t * 0.8 + p.phase) > 0.82;
      const busy = !walk && (p.s.status === 'typing' || p.s.status === 'tool');
      const read = !walk && st.act === 'read';
      const holding = !walk && (st.act === 'coffee' || st.act === 'water');
      const tap = Math.sin(t * (p.s.status === 'tool' ? 18 : 13) + p.phase) * 4;
      const leftX = celebrating ? -18 - Math.sin(t * 10) * 2 : -17;
      const leftY = celebrating ? -43 : scratch || read ? -35 :
        busy ? -28 + tap : -17 + step * 3;
      const rightX = wave ? 17 + Math.sin(t * 9) * 2 : 17;
      const rightY = wave ? -43 : busy ? -28 - tap : read || holding ? -35 : -19;
      c.beginPath(); c.moveTo(-9, -29); c.lineTo(leftX, leftY);
      c.moveTo(9, -29); c.lineTo(rightX, rightY);
      c.stroke();
      c.fillStyle = '#292d36';
      c.beginPath(); c.arc(leftX, leftY, 4, 0, 2 * Math.PI);
      c.arc(rightX, rightY, 4, 0, 2 * Math.PI); c.fill();
      // Capsule body with denim overalls.
      this.roundRect(-12, -44, 24, 40, 11, YELLOW, '#d3ad20');
      this.roundRect(-12, -17, 24, 14, 3, BLUE);
      c.fillStyle = BLUE;
      c.fillRect(-10, -26, 5, 15); c.fillRect(5, -26, 5, 15);
      c.fillStyle = '#153d68'; c.fillRect(-5, -14, 10, 7);
      c.fillStyle = '#f1cc34';
      c.beginPath(); c.arc(-7, -22, 1.4, 0, 2 * Math.PI); c.arc(7, -22, 1.4, 0, 2 * Math.PI); c.fill();
      // One or two large silver goggles with blinking eyes.
      c.strokeStyle = '#2b3038'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(-12, -32); c.lineTo(12, -32); c.stroke();
      for (let i = 0; i < eyes; i++) {
        const ex = eyes === 1 ? 0 : (i ? 5.7 : -5.7);
        c.fillStyle = '#9da8af'; c.beginPath(); c.arc(ex, -32, eyes === 1 ? 9 : 7.3, 0, 2 * Math.PI); c.fill();
        c.fillStyle = '#f8fbfd'; c.beginPath(); c.arc(ex, -32, eyes === 1 ? 6.8 : 5.4, 0, 2 * Math.PI); c.fill();
        const gaze = Math.sin(t * 0.7 + p.phase) * 1.25;
        c.fillStyle = '#755034'; c.beginPath(); c.arc(ex + 0.8 + gaze, -31, sleepy || Math.sin(t * 0.75 + p.phase) > 0.994 ? 1.5 : 3, 0, 2 * Math.PI); c.fill();
        c.fillStyle = INK; c.beginPath(); c.arc(ex + 1 + gaze, -31, 1.2, 0, 2 * Math.PI); c.fill();
      }
      c.strokeStyle = INK; c.lineWidth = 1.3;
      c.beginPath();
      if (p.s.status === 'error') c.arc(0, -19, 3, Math.PI * 1.1, Math.PI * 1.9);
      else c.arc(0, -23, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
      c.strokeStyle = INK; c.lineWidth = 1.4;
      for (let i = -1; i <= 1; i++) {
        c.beginPath(); c.moveTo(i * 3, -43); c.lineTo(i * 4, -49 - (p.h % 2) * 2); c.stroke();
      }
      c.restore();
      const top = b.y - bob - 49 * scale;
      if (!p.ambient) this.hit.push({ key: p.key, x0: b.x - 17, x1: b.x + 17, y0: top - 4, y1: foot.y + 5 });
      return { x: b.x, y: top, act: st.act };
    }
  }

  window.MinionsOffice = MinionsOffice;
})();
