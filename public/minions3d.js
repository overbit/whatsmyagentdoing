// Procedural, offline Minions-inspired characters and laboratory machinery.
// Only the opt-in lab scene uses these meshes; other scenes are untouched.
export function installMinions3D(Office3D, T) {
  const { Group, Mesh, MeshStandardMaterial, MeshBasicMaterial,
    BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, PointLight } = T;
  const skin = mat('#f9d539'), denim = mat('#27649b'), steel = mat('#a9b8c1', 0.35, 0.55);
  const dark = mat('#263545'), boots = mat('#252c35'), glass = mat('#e6fcff', 0.15, 0.12);
  const eyeWhite = mat('#fffdf1'), iris = mat('#795238'), black = mat('#222735');
  const yellowLight = mat('#ffe25b', 0.3, 0.05, '#ffcc35');
  const mintLight = mat('#68e5e1', 0.3, 0.05, '#1ddbd5');
  const isLab = (office) => office.plan?.scene?.id === 'minions';

  function mat(color, roughness = 0.8, metalness = 0, emissive = '#000000') {
    return new MeshStandardMaterial({ color, roughness, metalness, emissive,
      emissiveIntensity: emissive === '#000000' ? 0 : 0.8 });
  }
  function mesh(geometry, material, group, x, y, z) {
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  function cube(group, x, y, z, w, h, d, material) {
    return mesh(new BoxGeometry(w, h, d), material, group, x, y, z);
  }
  function ball(group, x, y, z, r, material, sx = 1, sy = 1, sz = 1) {
    const m = mesh(new SphereGeometry(r, 18, 12), material, group, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }
  function tube(group, x, y, z, radius, height, material) {
    return mesh(new CylinderGeometry(radius, radius, height, 16), material, group, x, y, z);
  }
  function minion(p) {
    const obj = new Group();
    const limbs = {};
    const oneEye = p.h % 3 === 0;
    const tall = p.h % 4 === 0;
    const scale = (p.s?.subagent ? 0.8 : 1) * (tall ? 1.06 : 0.93);
    obj.scale.setScalar(scale);

    // Capsule-shaped body, denim overalls and their straps.
    ball(obj, 0, 0.53, 0, 0.30, skin, 0.9, tall ? 1.52 : 1.25, 0.81);
    cube(obj, 0, 0.33, 0.035, 0.53, 0.29, 0.43, denim);
    cube(obj, 0, 0.42, 0.251, 0.30, 0.22, 0.045, denim);
    for (const x of [-0.205, 0.205]) {
      cube(obj, x, 0.47, 0.248, 0.09, 0.31, 0.07, denim);
      ball(obj, x, 0.55, 0.296, 0.025, yellowLight);
      limbs[x < 0 ? 'leftLeg' : 'rightLeg'] = new Group();
      const leg = limbs[x < 0 ? 'leftLeg' : 'rightLeg'];
      leg.position.set(x, 0.235, 0);
      tube(leg, 0, -0.11, 0, 0.068, 0.23, denim);
      ball(leg, 0, -0.22, 0.065, 0.09, boots, 1.0, 0.7, 1.45);
      obj.add(leg);
    }
    cube(obj, 0, 0.355, 0.284, 0.17, 0.11, 0.026, dark);
    // Goggles and elastic headband.
    tube(obj, 0, tall ? 0.78 : 0.735, -0.01, 0.301, 0.065, dark);
    for (const x of oneEye ? [0] : [-0.135, 0.135]) {
      const z = 0.25;
      ball(obj, x, tall ? 0.79 : 0.735, z, oneEye ? 0.179 : 0.145, steel, 1, 1, 0.51);
      ball(obj, x, tall ? 0.79 : 0.735, z + 0.080, oneEye ? 0.134 : 0.104, eyeWhite, 1, 1, 0.48);
      ball(obj, x + 0.027, tall ? 0.785 : 0.73, z + 0.133, 0.049, iris, 1, 1, 0.55);
      ball(obj, x + 0.036, tall ? 0.79 : 0.735, z + 0.157, 0.025, black, 1, 1, 0.5);
    }
    ball(obj, 0, 0.557, 0.27, 0.058, dark, 1.13, 0.34, 0.27);
    for (const x of [-0.105, 0, 0.105]) {
      const hair = tube(obj, x, tall ? 1.16 : 1.02, 0, 0.012, 0.12, black);
      hair.rotation.z = x * 2.5;
    }
    // Shoulder pivots allow walking, typing and waving.
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.26, 0.58, 0);
      const sleeve = tube(arm, side * 0.06, -0.13, 0, 0.052, 0.24, skin);
      sleeve.rotation.z = side * 0.42;
      ball(arm, side * 0.105, -0.245, 0, 0.071, boots);
      obj.add(arm);
      limbs[side < 0 ? 'leftArm' : 'rightArm'] = arm;
    }
    return { obj, limbs };
  }

  // A permanent human supervisor. The scene renders it independently of the
  // agent roster, so it never appears in statuses, filters or resume commands.
  function buildHuman() {
    const obj = new Group();
    const coat = mat('#e9f1f3'), coatSeam = mat('#a8beca');
    const face = mat('#dfa581'), hair = mat('#4c302e');
    const glasses = mat('#344758', 0.45, 0.45), shirt = mat('#377da5');

    // Dark trousers, shoes, white coat, collar and an identification badge.
    for (const x of [-0.12, 0.12]) {
      cube(obj, x, 0.32, 0, 0.18, 0.53, 0.20, dark);
      ball(obj, x, 0.08, 0.075, 0.12, boots, 1.05, 0.65, 1.42);
    }
    cube(obj, 0, 0.93, 0, 0.45, 0.69, 0.28, coat);
    cube(obj, 0, 0.92, 0.158, 0.19, 0.44, 0.03, shirt);
    for (const x of [-0.11, 0.11]) {
      const lapel = cube(obj, x, 1.1, 0.172, 0.11, 0.26, 0.05, coat);
      lapel.rotation.z = x > 0 ? 0.27 : -0.27;
    }
    cube(obj, 0, 0.81, 0.176, 0.02, 0.32, 0.025, coatSeam);
    cube(obj, 0.16, 0.98, 0.166, 0.11, 0.065, 0.025, shirt);
    cube(obj, 0.14, 0.99, 0.187, 0.045, 0.018, 0.02, yellowLight);

    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.27, 1.17, 0);
      cube(arm, side * 0.008, -0.165, 0, 0.13, 0.36, 0.16, coat);
      ball(arm, side * 0.012, -0.35, 0.02, 0.075, face);
      obj.add(arm);
      arms.push(arm);
    }
    // Recognisable human face, hair and spectacles, in contrast to goggles.
    tube(obj, 0, 1.32, 0, 0.069, 0.15, face);
    ball(obj, 0, 1.47, 0, 0.184, face, 0.89, 1.08, 0.82);
    ball(obj, 0, 1.604, -0.018, 0.164, hair, 1.03, 0.38, 0.90);
    ball(obj, -0.146, 1.51, 0, 0.075, hair, 0.56, 1.3, 1.0);
    ball(obj, 0.146, 1.51, 0, 0.075, hair, 0.56, 1.3, 1.0);
    for (const x of [-0.079, 0.079]) {
      const rim = ball(obj, x, 1.479, 0.137, 0.066, glasses, 1.0, 0.8, 0.35);
      ball(obj, x, 1.479, 0.16, 0.049, eyeWhite, 1.0, 0.85, 0.22);
      ball(obj, x + 0.01, 1.48, 0.171, 0.02, black);
    }
    cube(obj, 0, 1.48, 0.16, 0.045, 0.015, 0.018, glasses);
    ball(obj, 0, 1.393, 0.146, 0.045, iris, 1.0, 0.3, 0.25);
    return { obj, arm: arms[1] };
  }

  const originalBuild = Office3D.prototype.build;
  Office3D.prototype.build = function () {
    originalBuild.call(this);
    this.humanHelper = null;
    if (!this.plan.helper) return;
    const human = buildHuman();
    const { x, y } = this.plan.helper;
    // Packs can have raised terrain; keep the helper on the walkable surface.
    const ground = this.plan.scene ? this.surfaceAt(x, y) : 0;
    human.obj.position.set(x, ground, y);
    human.obj.rotation.y = 0.32;
    this.room.add(human.obj);
    this.humanHelper = human;
  };

  const originalFacing = Office3D.prototype.facing;
  Office3D.prototype.facing = function (person, state) {
    if (this.plan.helper && person.helpSpot && state.pose !== 'walk') {
      const helper = this.plan.helper;
      return Math.atan2(helper.x - person.x, helper.y - person.y);
    }
    return originalFacing.call(this, person, state);
  };

  const originalDraw = Office3D.prototype.draw;
  Office3D.prototype.draw = function () {
    const result = originalDraw.call(this);
    if (result === false || !this.humanHelper) return result;

    // Reuse the existing canvas overlay for a legible world-anchored label.
    const p = this.humanHelper.obj.position.clone();
    p.y += 1.98;
    p.project(this.camera);
    if (p.z < -1 || p.z > 1) return result;
    const x = (p.x + 1) * this.cw / 2;
    const y = (1 - p.y) * this.ch / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.roundRect(x - 27, y - 11, 54, 20, 8, '#203a4b');
    ctx.font = '800 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff4ca';
    ctx.fillText('HUMAN', x, y - 1);
    if ([...this.people.values()].some((a) => a.helpSpot && a.s.status === 'waiting')) {
      this.roundRect(x + 27, y - 14, 23, 23, 8, '#ffdc42');
      ctx.font = '900 15px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#203a4b';
      ctx.fillText('?', x + 38.5, y - 2);
    }
    ctx.restore();
    return result;
  };

  const originalActor = Office3D.prototype.actorFor;
  Office3D.prototype.actorFor = function (p) {
    if (!isLab(this)) return originalActor.call(this, p);
    const old = this.actors.get(p.key);
    if (old) return old;
    const { obj, limbs } = minion(p);
    const prop = new Group();
    const cup = tube(prop, 0, 0, 0, 0.047, 0.12, glass);
    const book = cube(prop, 0, 0, 0, 0.22, 0.25, 0.03, denim);
    cup.visible = book.visible = false;
    this.scene.add(obj, prop);
    const a = { obj, limbs, mixer: { update() {} }, actions: {}, current: null,
      head: null, armR: obj, prop, cup, book, yaw: 0, last: { x: p.x, y: p.y } };
    this.actors.set(p.key, a);
    return a;
  };

  const originalSync = Office3D.prototype.syncActors;
  Office3D.prototype.syncActors = function (dt) {
    originalSync.call(this, dt);
    if (this.humanHelper) {
      const waiting = [...this.people.values()].some(
        (p) => p.helpSpot && p.s.status === 'waiting',
      );
      this.humanHelper.arm.rotation.z = waiting ? 2.7 + Math.sin(this.t / 240) * 0.13 : 0;
    }
    if (!isLab(this)) return;
    for (const p of this.people.values()) {
      const a = this.actors.get(p.key);
      if (!a?.limbs) continue;
      const st = this.stateOf(p);
      const time = this.t / 1000 + p.phase;
      const swing = st.pose === 'walk' ? Math.sin(time * 10) * 0.48 : 0;
      a.limbs.leftLeg.rotation.x = swing;
      a.limbs.rightLeg.rotation.x = -swing;
      a.limbs.leftArm.rotation.x = -swing * 0.75;
      a.limbs.rightArm.rotation.x = swing * 0.75;
      a.limbs.rightArm.rotation.z = st.act === 'wave' ? 2.7 + Math.sin(time * 8) * 0.26 : -0.14;
      if (st.act === 'type' || st.act === 'station') {
        a.limbs.leftArm.rotation.x = -0.75 + Math.sin(time * 17) * 0.18;
        a.limbs.rightArm.rotation.x = -0.75 - Math.sin(time * 17) * 0.18;
      }
    }
  };

  const originalSceneProp = Office3D.prototype.buildSceneProp;
  Office3D.prototype.buildSceneProp = function (p) {
    if (!isLab(this)) return originalSceneProp.call(this, p);
    const g = new Group();
    g.position.set(p.x, 0, p.y);
    if (p.special === 'lab-console') {
      cube(g, 0, 0.37, -0.55, 1.1, 0.72, 0.54, mat('#607e91'));
      cube(g, 0, 0.78, -0.64, 0.92, 0.12, 0.68, steel);
      cube(g, 0, 1.08, -0.7, 0.8, 0.52, 0.12, dark);
      cube(g, 0, 1.08, -0.625, 0.67, 0.38, 0.03, mintLight);
      for (let i = 0; i < 4; i++) {
        ball(g, -0.27 + i * 0.18, 0.81, -0.29, 0.035, i % 2 ? yellowLight : mintLight);
      }
    } else if (p.special === 'tank') {
      tube(g, 0, (p.h || 1.6) / 2, 0, p.r || 0.5, p.h || 1.6, mat(p.liquid || '#82e59b', 0.22, 0.2, p.liquid || '#82e59b'));
      tube(g, 0, 0.075, 0, (p.r || 0.5) + 0.09, 0.15, steel);
      tube(g, 0, (p.h || 1.6) + 0.06, 0, (p.r || 0.5) + 0.09, 0.12, steel);
      for (let i = 0; i < 5; i++) ball(g, Math.sin(i * 2.1) * 0.18,
        0.3 + (i * 0.31) % (p.h - 0.3), Math.cos(i * 2.1) * 0.16, 0.055, glass);
    } else if (p.special === 'rocket') {
      tube(g, 0, 1.05, 0, 0.43, 1.95, mat('#e4edf0', 0.35, 0.25));
      mesh(new ConeGeometry(0.43, 0.83, 20), yellowLight, g, 0, 2.45, 0);
      ball(g, 0, 1.46, 0.43, 0.23, steel);
      ball(g, 0, 1.46, 0.555, 0.155, mintLight);
      for (const side of [-1, 1]) cube(g, side * 0.47, 0.42, 0, 0.22, 0.8, 0.38, denim);
      tube(g, 0, 0.11, 0, 0.31, 0.2, dark);
    } else if (p.special === 'banana') {
      const b = ball(g, 0, 0.78, 0, 0.36, yellowLight, 1.0, 0.28, 0.45);
      b.rotation.z = -0.35;
      cube(g, 0.28, 0.82, 0, 0.06, 0.13, 0.07, dark);
    } else if (p.special === 'pipe') {
      const metal = mat('#7f9bad', 0.35, 0.65);
      const pipe = tube(g, 0, p.h || 2.4, 0, 0.11, p.w || 2.3, metal);
      pipe.rotation.z = Math.PI / 2;
      tube(g, (p.w || 2.3) / 2, 1.83, 0, 0.11, 1.1, metal);
    } else return originalSceneProp.call(this, p);
    this.room.add(g);
  };
}
