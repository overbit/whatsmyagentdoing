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
