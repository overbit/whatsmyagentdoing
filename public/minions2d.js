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
    return {
      W: def.W, D: def.D, grid, items, props: def.props, desks, pois, door: def.spawn,
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
      for (const item of this.plan.items) item.draw = () => this.drawLabProp(item.prop);
    }

    drawLabProp(p) {
      const c = this.ctx;
      const P = (x, y, z = 0) => this.iso(x, y, z);
      if (p.special === 'box') {
        this.box(p.x, p.y, 0, p.w, p.d, p.h, '#8fa6b2', p.color, '#456173');
        return;
      }
      if (p.special === 'lab-console') {
        const x = p.x, y = p.y;
        this.box(x - 0.53, y - 0.83, 0, 1.06, 0.47, 0.74, '#738f9d', '#486878', '#344f61');
        this.box(x - 0.38, y - 0.74, 0.74, 0.75, 0.13, 0.46, '#3e6575', '#263d50', '#1b3043');
        const screen = P(x, y - 0.65, 1.04);
        c.fillStyle = '#3bd8dd'; c.fillRect(screen.x - 10, screen.y - 8, 21, 12);
        c.fillStyle = '#b3fff4';
        for (let i = 0; i < 3; i++) c.fillRect(screen.x - 7 + i * 6, screen.y - 5 + ((this.t / 350 + i * 2) % 4), 3, 2);
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
      const walk = st.pose === 'walk';
      const step = walk ? Math.sin(t * 12 + p.phase) : 0;
      const bob = walk ? Math.abs(step) * 2 : 0;
      const foot = this.iso(p.x, p.y);
      const b = this.iso(p.x, p.y, st.sitZ);
      const scale = p.s.subagent ? 0.8 : 1;
      const wave = st.act === 'wave';
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
      c.beginPath(); c.moveTo(-9, -29); c.lineTo(-17, -17 + step * 3);
      c.moveTo(9, -29); c.lineTo(wave ? 17 + Math.sin(t * 9) * 2 : 17, wave ? -43 : -19);
      c.stroke();
      c.fillStyle = '#292d36';
      c.beginPath(); c.arc(-17, -17 + step * 3, 4, 0, 2 * Math.PI);
      c.arc(wave ? 17 + Math.sin(t * 9) * 2 : 17, wave ? -43 : -19, 4, 0, 2 * Math.PI); c.fill();
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
        c.fillStyle = '#755034'; c.beginPath(); c.arc(ex + 0.8, -31, sleepy || Math.sin(t * 0.75 + p.phase) > 0.994 ? 1.5 : 3, 0, 2 * Math.PI); c.fill();
        c.fillStyle = INK; c.beginPath(); c.arc(ex + 1, -31, 1.2, 0, 2 * Math.PI); c.fill();
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
      this.hit.push({ key: p.key, x0: b.x - 17, x1: b.x + 17, y0: top - 4, y1: foot.y + 5 });
      return { x: b.x, y: top, act: st.act };
    }
  }

  window.MinionsOffice = MinionsOffice;
})();
