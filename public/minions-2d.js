// Local, hand-drawn Minions-inspired theme for the isometric office.
// Keep simulation, status bubbles, hit-testing and provider badges in Office.
(() => {
  'use strict';

  const P = window.Office.prototype;
  const YELLOW = '#ffda38';
  const YELLOW_SHADE = '#e9b92b';
  const BLUE = '#2756a5';
  const BLUE_LIGHT = '#3e70bd';
  const INK = '#20283e';
  const METAL = '#b9c7ce';
  const WHITE = '#fffdf4';

  const light = {
    wood1: '#ffec99', wood2: '#ffe680', woodLine: 'rgba(107,80,17,.11)',
    tileA: '#f8f5dc', tileB: '#e7ebee', carpet: '#95b5d7',
    carpetLine: 'rgba(29,70,122,.1)', wallL: '#fff6cf', wallR: '#f9e7ad',
    wallTop: '#fff9e3', trim: '#d3ab43', deskTop: '#5d8aca',
    deskL: '#3869a9', deskR: '#2a548f', chair: '#23375d',
    rug: '#7fb8bc', rugEdge: '#427f90', couch: '#3464aa',
    couchD: '#254b83', mat: '#5f91bd', metal: '#a0adb9',
    counter: '#fffaf0', counterL: '#cbd5e0', counterR: '#aabac9',
    plant: '#71a359', pot: '#f4a93b', bubble: '#fffdf4',
    bubbleInk: INK, text: INK, tagBg: 'rgba(255,251,224,.94)',
    book: ['#ffda38', '#2653a2', '#ef7e36', '#6eb5b0', '#a86dc9'],
  };
  const dark = {
    wood1: '#4a4960', wood2: '#3c3f59', woodLine: 'rgba(255,255,255,.06)',
    tileA: '#273453', tileB: '#303e5d', carpet: '#34476a',
    carpetLine: 'rgba(255,255,255,.07)', wallL: '#354269',
    wallR: '#2c3656', wallTop: '#4b5577', trim: '#a5883e',
    deskTop: '#5477a7', deskL: '#365889', deskR: '#29446f',
    chair: '#111e36', rug: '#406f83', rugEdge: '#284d69',
    couch: '#426eae', couchD: '#294a7e', mat: '#3d607e',
    metal: '#859ab0', counter: '#d5dbdf', counterL: '#9ca9b6',
    counterR: '#7c8d9b', plant: '#5c9874', pot: '#bd7537',
    bubble: '#fff9df', bubbleInk: INK, text: '#fff2c6',
    tagBg: 'rgba(31,38,66,.94)',
    book: ['#ffda38', '#6e9fd8', '#ed8a4c', '#80c1b8', '#b88ddd'],
  };

  const drawRoom = P.drawRoom;
  P.drawRoom = function () {
    Object.assign(this.pal, this.pal.dark ? dark : light);
    drawRoom.call(this);
    if (this.plan.scene) return;
    // Factory lab signs use the same wall projection as the existing posters.
    this.onWall('x0', Math.min(5.2, this.plan.D - 1.5), 1.55, (c) => {
      c.save();
      c.rotate(-0.03);
      c.textAlign = 'center';
      c.font = '900 10px ui-sans-serif, system-ui, sans-serif';
      c.fillStyle = this.pal.dark ? '#ffeb85' : '#243b6f';
      c.fillText('BANANA', 0, -4);
      c.font = '800 7px ui-sans-serif, system-ui, sans-serif';
      c.fillText('RESEARCH LAB', 0, 6);
      c.restore();
    });
  };

  // Draw a capsule-shaped, one- or two-eyed worker in place of a human sprite.
  // Coordinates are intentionally relative to the original person's floor point
  // so wandering, sitting and hover labels work exactly as before.
  P.person = function (p) {
    const c = this.ctx;
    const st = this.stateOf(p);
    const s = p.s || {};
    const t = this.t / 1000;
    p.pose = st.pose;
    const walking = st.pose === 'walk';
    const sitting = st.pose === 'sit';
    const forward = st.face !== 'back';
    const step = walking ? Math.sin(t * 12 + p.phase) : 0;
    const floor = this.iso(p.x, p.y, 0);
    const at = this.iso(p.x, p.y, st.sitZ);
    const sc = s.subagent ? 0.8 : 1;
    const x = at.x + (st.act === 'pingpong' ? Math.sin(t * 7 + p.phase) * 4 : 0);
    const y = at.y - (walking ? Math.abs(step) * 1.5 : 0);
    const top = sitting ? -33 : -40;
    const bottom = sitting ? -5 : -9;
    const faceY = top + 13;
    const twoEyes = p.h % 3 !== 0;

    c.save();
    c.fillStyle = this.pal.shadow;
    c.beginPath(); c.ellipse(floor.x, floor.y, 11, 5, 0, 0, Math.PI * 2); c.fill();
    if (this.hoverKey === p.key) {
      c.strokeStyle = s.status === 'error' ? '#d94537' : BLUE;
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(floor.x, floor.y, 15, 7, 0, 0, Math.PI * 2); c.stroke();
    }
    c.translate(x, y);
    c.scale(sc, sc);
    c.lineCap = 'round';

    const line = (ax, ay, bx, by, width, color) => {
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by);
      c.lineWidth = width; c.strokeStyle = color; c.stroke();
    };
    const oval = (cx, cy, rx, ry, color) => {
      c.fillStyle = color; c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
    };
    const round = (rx, ry, w, h, radius, color) => {
      c.fillStyle = color; c.beginPath();
      c.roundRect(rx, ry, w, h, radius); c.fill();
    };

    // Feet, legs, and gloves animate with the underlying status state.
    const leg = sitting ? 0 : step * 2.1;
    line(-4, bottom - 1, -4, sitting ? -1 : -1 + leg, 4, BLUE);
    line(4, bottom - 1, 4, sitting ? -1 : -1 - leg, 4, BLUE);
    oval(-5, sitting ? -1 : leg, 4, 2.7, INK);
    oval(5, sitting ? -1 : -leg, 4, 2.7, INK);

    const isWaving = st.act === 'wave';
    const typing = st.act === 'type';
    const lively = walking ? step * 3 : 0;
    const leftHand = { x: -13, y: top + 25 + (typing ? Math.sin(t * 18 + p.phase) * 2 : lively) };
    const rightHand = {
      x: isWaving ? 14 + Math.sin(t * 8 + p.phase) * 2 : 13,
      y: isWaving ? top - 3 : top + 25 - (typing ? Math.sin(t * 18 + p.phase) * 2 : lively),
    };
    line(-7, top + 22, leftHand.x, leftHand.y, 5, YELLOW_SHADE);
    line(7, top + 22, rightHand.x, rightHand.y, 5, YELLOW_SHADE);
    oval(leftHand.x, leftHand.y, 3.4, 3.4, INK);
    oval(rightHand.x, rightHand.y, 3.4, 3.4, INK);

    round(-10, top, 20, bottom - top + 2, 10, YELLOW);
    // Denim overalls: bib, front pocket, and the two diagonal straps.
    round(-10, top + 23, 20, bottom - top - 21, 4, BLUE);
    round(-6.5, top + 20, 13, 14, 2, BLUE_LIGHT);
    line(-8, top + 19, -4, top + 25, 3, BLUE);
    line(8, top + 19, 4, top + 25, 3, BLUE);
    oval(-6.5, top + 22.5, 1.2, 1.2, METAL);
    oval(6.5, top + 22.5, 1.2, 1.2, METAL);
    round(-4, top + 29, 8, 5, 2, BLUE);
    c.font = 'bold 5px ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = WHITE; c.textAlign = 'center';
    c.fillText('G', 0, top + 33);

    // A thin black strap wraps the head even when the agent walks away.
    line(-9, faceY, 9, faceY, 3.2, INK);
    if (forward) {
      const eyes = twoEyes ? [-4.8, 4.8] : [0];
      const r = twoEyes ? 4.8 : 6;
      const blinking = Math.sin(t * 0.8 + p.phase * 3) > 0.987;
      for (const ex of eyes) {
        oval(ex, faceY, r + 1.3, r + 1.3, '#657b87');
        oval(ex, faceY, r, r, METAL);
        oval(ex, faceY, r - 1.4, r - 1.4, WHITE);
        if (blinking) line(ex - 2, faceY, ex + 2, faceY, 1.3, INK);
        else oval(ex + (st.act === 'think' ? 0.7 : 0), faceY + 0.5, 1.55, 1.8, '#34291e');
      }
      c.strokeStyle = '#664525'; c.lineWidth = 1.2;
      c.beginPath();
      if (s.status === 'error') c.arc(0, faceY + 10, 2.7, Math.PI * 1.15, Math.PI * 1.85);
      else c.arc(0, faceY + 7, 3.2, 0.18, Math.PI - 0.18);
      c.stroke();
    }
    // A few tufts of dark hair keep the silhouettes distinct at a glance.
    const hairs = 1 + p.h % 3;
    for (let k = 0; k < hairs; k++) {
      const hx = (k - (hairs - 1) / 2) * 3;
      line(hx, top + 1, hx + (k % 2 ? 2 : -1), top - 5 - (k % 2), 1.4, INK);
    }
    c.restore();

    const headTop = y + (top - 6) * sc;
    this.hit.push({ key: p.key, x0: x - 14, x1: x + 14, y0: headTop - 16, y1: floor.y + 4 });
    return { x, y: headTop, act: st.act };
  };

  // The office pet gets a little one-eyed yellow robot outfit too.
  P.drawCat = function () {
    const c = this.ctx;
    const p = this.iso(this.cat.x, this.cat.y, 0);
    c.save();
    c.translate(p.x, p.y);
    c.fillStyle = this.pal.shadow;
    c.beginPath(); c.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = YELLOW;
    c.beginPath(); c.ellipse(0, -8, 8, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = BLUE; c.fillRect(-7, -7, 14, 6);
    ovalEye(c, 0, -11);
    c.restore();
  };

  function ovalEye(c, x, y) {
    const circle = (r, col) => {
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    };
    circle(5, METAL);
    circle(3.6, WHITE);
    circle(1.5, INK);
  }

  window.MINION_PALETTE = { yellow: YELLOW, blue: BLUE, ink: INK };
})();