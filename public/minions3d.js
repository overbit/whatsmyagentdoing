// Procedural, offline Minions-inspired characters and laboratory machinery.
// Only the opt-in lab scene uses these meshes; other scenes are untouched.
export function installMinions3D(Office3D, T) {
  const { Group, Mesh, MeshStandardMaterial, MeshBasicMaterial,
    BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry } = T;
  const skin = mat('#f9d539'), denim = mat('#27649b'), steel = mat('#a9b8c1', 0.35, 0.55);
  const dark = mat('#263545'), boots = mat('#252c35'), glass = mat('#e6fcff', 0.15, 0.12);
  const eyeWhite = mat('#fffdf1'), iris = mat('#795238'), black = mat('#222735');
  const yellowLight = mat('#ffe25b', 0.3, 0.05, '#ffcc35');
  const mintLight = mat('#68e5e1', 0.3, 0.05, '#1ddbd5');
  const isLab = (office) => office.plan?.scene?.id === 'minions';
  // This lightweight controller is loaded by the dashboard before either
  // renderer. Absent in isolated module tests or other map integrations.
  const ambientSystem = typeof window === 'undefined' ? null : window.MinionsAmbient;

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
    const body = ball(obj, 0, 0.53, 0, 0.30, skin, 0.9, tall ? 1.52 : 1.25, 0.81);
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
    // The goggle assembly and pupils move independently of the torso.
    const goggles = new Group();
    obj.add(goggles);
    const pupils = [], irises = [], blinkParts = [];
    tube(goggles, 0, tall ? 0.78 : 0.735, -0.01, 0.301, 0.065, dark);
    for (const x of oneEye ? [0] : [-0.135, 0.135]) {
      const z = 0.25;
      ball(goggles, x, tall ? 0.79 : 0.735, z, oneEye ? 0.179 : 0.145, steel, 1, 1, 0.51);
      const white = ball(goggles, x, tall ? 0.79 : 0.735, z + 0.080,
        oneEye ? 0.134 : 0.104, eyeWhite, 1, 1, 0.48);
      const irisPart = ball(goggles, x + 0.027, tall ? 0.785 : 0.73, z + 0.133, 0.049, iris, 1, 1, 0.55);
      const pupil = ball(goggles, x + 0.036, tall ? 0.79 : 0.735, z + 0.157, 0.025, black, 1, 1, 0.5);
      irises.push({ obj: irisPart, restX: irisPart.position.x });
      pupils.push({ obj: pupil, restX: pupil.position.x });
      blinkParts.push(white, irisPart, pupil);
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
    const banana = new Group();
    // Three overlapping curved pieces read as a banana at isometric zoom.
    for (let i = -1; i <= 1; i++) {
      const segment = ball(banana, i * 0.105, Math.abs(i) * 0.034, 0,
        0.095, yellowLight, 1.08, 0.48, 0.6);
      segment.rotation.z = -i * 0.27;
    }
    cube(banana, 0.205, 0.08, 0, 0.04, 0.065, 0.05, dark);
    banana.visible = false;
    banana.position.set(0.27, 0.45, 0.35);
    obj.add(banana);
    return { obj, limbs, features: { body, goggles, banana, pupils: pupils.map((p) => p.obj),
      eyes: [...irises, ...pupils], blinkParts, bodyScaleY: body.scale.y } };
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
    // Recreated with the map: no stale meshes or effects when scenes switch.
    this.labFx = isLab(this)
      ? { consoles: [], tanks: [], rockets: [], conveyors: [], drones: [], vents: [], bots: [] }
      : null;
    originalBuild.call(this);
    this.ambientActors = [];
    this.ambientNpcs = [];
    if (isLab(this) && ambientSystem && this.plan.grid) {
      for (const npc of ambientSystem.create(this.plan.scene, this.plan.grid)) {
        const { obj, limbs, features } = minion(npc);
        this.room.add(obj);
        this.ambientActors.push({ npc, obj, limbs, features, yaw: 0 });
        this.ambientNpcs.push(npc);
      }
    }
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

    // Project to screen-space so the same badge stays legible at any zoom.
    const p = this.humanHelper.obj.position.clone();
    p.y += 2.12;
    p.project(this.camera);
    if (p.z < -1 || p.z > 1) return result;
    const x = (p.x + 1) * this.cw / 2;
    const y = (1 - p.y) * this.ch / 2 - 35;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawHelperBadge(x, y, this.helperWaiting());
    ctx.restore();
    return result;
  };

  const originalActor = Office3D.prototype.actorFor;
  Office3D.prototype.actorFor = function (p) {
    if (!isLab(this)) return originalActor.call(this, p);
    const old = this.actors.get(p.key);
    if (old) return old;
    const { obj, limbs, features } = minion(p);
    const prop = new Group();
    const cup = tube(prop, 0, 0, 0, 0.047, 0.12, glass);
    const book = cube(prop, 0, 0, 0, 0.22, 0.25, 0.03, denim);
    cup.visible = book.visible = false;
    this.scene.add(obj, prop);
    const a = { obj, limbs, mixer: { update() {} }, actions: {}, current: null,
      head: null, armR: obj, prop, cup, book, features,
      lastStatus: p.s?.status, celebrateUntil: 0,
      yaw: 0, last: { x: p.x, y: p.y } };
    this.actors.set(p.key, a);
    return a;
  };

  // Ambient motion is driven by the render clock, not session updates.
  // All meshes are created once per scene; this only changes their transforms
  // or existing materials, so idle maps stay lively without frame allocations.
  const consoleHues = { thinking: '#768df7', tool: '#ffbd55', typing: '#47e9b0',
    waiting: '#ffd55b', error: '#ff7166' };
  function animateLab(office, time) {
    const fx = office.labFx;
    if (!fx) return;
    for (const c of fx.consoles) {
      let status = null;
      for (const person of office.people.values()) {
        if (person.mode === 'work' && person.desk && !person.helpSpot &&
            person.desk.x === c.x && person.desk.y === c.y) {
          status = person.s?.status || null;
          break;
        }
      }
      if (status !== c.status) {
        c.status = status;
        c.screen.material.emissive.set(consoleHues[status] || '#23c8d4');
        c.screen.material.color.set(consoleHues[status] || '#42d9c7');
      }
      const speed = status === 'tool' || status === 'typing' ? 12 : status ? 5 : 1.8;
      c.screen.material.emissiveIntensity = (status ? 0.8 : 0.35) +
        Math.sin(time * speed + c.phase) * (status ? 0.33 : 0.1);
      for (let i = 0; i < c.leds.length; i++) {
        c.leds[i].material.emissiveIntensity =
          Math.sin(time * speed + c.phase + i * 1.4) > 0.1 ? 1.35 : 0.12;
      }
    }
    for (const tank of fx.tanks) {
      const travel = Math.max(0.45, tank.h - 0.5);
      for (let i = 0; i < tank.bubbles.length; i++) {
        const bubble = tank.bubbles[i];
        const age = time * (0.3 + i * 0.045) + i * 0.31 + tank.phase * 0.12;
        bubble.position.y = 0.25 + age % travel;
        bubble.position.x = Math.sin(time * 1.6 + i * 1.7) * 0.08;
      }
      tank.liquid.material.emissiveIntensity = 0.43 + Math.sin(time * 1.3 + tank.phase) * 0.18;
    }
    for (const rocket of fx.rockets) {
      const cycle = (time + rocket.phase) % 13;
      rocket.flame.visible = cycle < 1.25;
      if (rocket.flame.visible) {
        rocket.flame.scale.y = 0.7 + Math.sin(time * 22) * 0.23;
        rocket.flame.material.emissiveIntensity = 0.75 + Math.sin(time * 18) * 0.22;
      }
    }
    for (const conveyor of fx.conveyors) {
      for (let i = 0; i < conveyor.bananas.length; i++) {
        const banana = conveyor.bananas[i];
        banana.position.x = 0.25 + (time * 0.35 + i * 0.76) % (conveyor.w - 0.35);
        banana.rotation.z = Math.sin(time * 2 + i) * 0.13;
      }
    }
    for (const drone of fx.drones) {
      drone.obj.position.x = Math.sin(time * 0.58) * drone.range;
      drone.obj.position.y = drone.height + Math.sin(time * 1.9) * 0.12;
      drone.obj.rotation.z = Math.sin(time * 0.58) * 0.12;
      for (let i = 0; i < drone.rotors.length; i++) {
        drone.rotors[i].rotation.y = time * (i ? -22 : 22);
      }
    }
    for (const vent of fx.vents) {
      for (let i = 0; i < vent.steam.length; i++) {
        const wisp = vent.steam[i];
        const age = (time * 0.4 + i * 0.19) % 1;
        wisp.position.y = 0.19 + age * 1.4;
        wisp.position.x = Math.sin(time * 1.1 + i * 2.2) * 0.12;
        wisp.material.opacity = (1 - age) * 0.4;
      }
    }
    for (const bot of fx.bots) {
      bot.obj.position.x = Math.sin(time * 0.46) * bot.range;
      bot.obj.position.z = Math.cos(time * 0.46) * 0.18;
      bot.obj.rotation.y = Math.sin(time * 0.46) > 0 ? Math.PI / 4 : -Math.PI / 4;
    }
  }

  function animateSnack(features, progress, time) {
    const banana = features.banana;
    banana.visible = true;
    // Lift to the mouth in repeated bites; shrink across the snack.
    const bite = Math.floor(Math.max(0, Math.min(0.999, progress)) * 4);
    banana.scale.setScalar(1 - bite * 0.19);
    banana.position.set(0.24 - Math.sin(time * 7) * 0.08,
      0.48 + Math.max(0, Math.sin(time * 7)) * 0.19, 0.36);
  }

  function animateAmbient(office, dt) {
    if (!ambientSystem || !office.ambientActors?.length) return;
    ambientSystem.tick(office.ambientNpcs, office.plan.grid, dt);
    for (const actor of office.ambientActors) {
      const npc = actor.npc, limbs = actor.limbs, f = actor.features;
      const time = office.t / 1000 + npc.phase;
      const walking = npc.path.length > 0;
      const step = walking ? Math.sin(time * 10) * 0.5 : 0;
      actor.obj.position.set(npc.x, 0, npc.y);
      if (walking) {
        const next = npc.path[0];
        const dx = next.x - npc.x, dy = next.y - npc.y;
        const angle = Math.atan2(dx, dy);
        const delta = Math.atan2(Math.sin(angle - actor.yaw), Math.cos(angle - actor.yaw));
        actor.yaw += delta * Math.min(1, dt * 7);
      } else {
        actor.yaw += Math.sin(time * 0.6) * dt * 0.1;
      }
      actor.obj.rotation.y = actor.yaw;
      f.body.scale.y = f.bodyScaleY * (1 + Math.sin(time * 2.2) * 0.02);
      f.goggles.rotation.z = Math.sin(time * 0.8) * 0.027;
      f.goggles.position.y = Math.sin(time * 1.2) * 0.012;
      for (const eye of f.eyes) eye.obj.position.x = eye.restX + Math.sin(time * 0.7) * 0.025;
      const blink = Math.sin(time * 1.15) > 0.995 ? 0.14 : 1;
      for (const eye of f.blinkParts) eye.scale.y = blink;
      limbs.leftLeg.rotation.x = step;
      limbs.rightLeg.rotation.x = -step;
      limbs.leftArm.rotation.x = -step * 0.75;
      limbs.rightArm.rotation.x = step * 0.75;
      limbs.leftArm.rotation.z = 0.13;
      limbs.rightArm.rotation.z = -0.13;
      actor.obj.position.y = npc.act === 'dance' ? Math.abs(Math.sin(time * 8)) * 0.07 : 0;
      f.banana.visible = false;
      if (walking) continue;
      if (npc.act === 'eat-banana') {
        limbs.rightArm.rotation.x = -0.9 + Math.sin(time * 7) * 0.15;
        limbs.rightArm.rotation.z = 1.15;
        animateSnack(f, npc.actionProgress, time);
      } else if (npc.act === 'dance') {
        limbs.leftArm.rotation.z = -2.2 + Math.sin(time * 9) * 0.2;
        limbs.rightArm.rotation.z = 2.2 - Math.sin(time * 9) * 0.2;
        limbs.leftLeg.rotation.x = Math.sin(time * 8) * 0.25;
        limbs.rightLeg.rotation.x = -limbs.leftLeg.rotation.x;
      } else if (npc.act === 'chat') {
        limbs.rightArm.rotation.z = 2.0 + Math.sin(time * 6) * 0.2;
      } else if (npc.act === 'inspect') {
        limbs.rightArm.rotation.x = -1.15 + Math.sin(time * 3) * 0.14;
        f.goggles.rotation.z = -0.08;
      } else if (npc.act === 'stretch') {
        limbs.leftArm.rotation.z = -2.5;
        limbs.rightArm.rotation.z = 2.5;
      }
    }
  }

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
    animateLab(this, this.t / 1000);
    animateAmbient(this, dt);
    for (const p of this.people.values()) {
      const a = this.actors.get(p.key);
      if (!a?.limbs) continue;
      const st = this.stateOf(p);
      const time = this.t / 1000 + (p.phase || 0);
      const status = p.s?.status || 'idle';
      if (status !== a.lastStatus) {
        a.lastStatus = status;
        if (status === 'done') a.celebrateUntil = this.t + 2400;
      }
      const celebrating = status === 'done' && a.celebrateUntil > this.t &&
        st.pose !== 'walk';
      const f = a.features;
      // Breathing, slow goggle tilts, glances and occasional goggle adjustment
      // keep even a single idle Minion lively without allocating new meshes.
      f.body.scale.y = f.bodyScaleY * (1 + 0.018 * Math.sin(time * 2.2));
      f.goggles.position.y = Math.sin(time * 1.25) * 0.012;
      f.goggles.rotation.z = Math.sin(time * 0.85) * 0.028;
      const gaze = Math.sin(time * 0.68) * 0.028;
      for (const eye of f.eyes) eye.obj.position.x = eye.restX + gaze;
      const eyelid = Math.sin(time * 1.15) > 0.996 ? 0.14 : 1;
      for (const eye of f.blinkParts) eye.scale.y = eyelid;
      const swing = st.pose === 'walk' ? Math.sin(time * 10) * 0.48 : 0;
      a.limbs.leftLeg.rotation.x = swing;
      a.limbs.rightLeg.rotation.x = -swing;
      a.limbs.leftArm.rotation.x = -swing * 0.75;
      a.limbs.rightArm.rotation.x = swing * 0.75;
      a.limbs.leftArm.rotation.z = 0.13;
      a.limbs.rightArm.rotation.z = -0.13;
      f.banana.visible = false;
      if (st.pose === 'walk') continue;
      if (celebrating) {
        a.limbs.leftArm.rotation.z = -2.3 + Math.sin(time * 11) * 0.15;
        a.limbs.rightArm.rotation.z = 2.3 - Math.sin(time * 11) * 0.15;
        f.goggles.position.y = 0.035 + Math.abs(Math.sin(time * 9)) * 0.03;
      } else if (status === 'waiting' || st.act === 'wave') {
        a.limbs.rightArm.rotation.z = 2.6 + Math.sin(time * 8) * 0.24;
        a.limbs.leftArm.rotation.x = -0.22;
      } else if (st.act === 'eat-banana') {
        a.limbs.rightArm.rotation.x = -0.9 + Math.sin(time * 7) * 0.15;
        a.limbs.rightArm.rotation.z = 1.15;
        animateSnack(f, (time * 0.17) % 1, time);
      } else if (status === 'typing' || status === 'tool' || st.act === 'type') {
        const speed = status === 'tool' ? 18 : 13;
        a.limbs.leftArm.rotation.x = -0.8 + Math.sin(time * speed) * 0.25;
        a.limbs.rightArm.rotation.x = -0.8 - Math.sin(time * speed) * 0.25;
      } else if (status === 'thinking') {
        a.limbs.leftArm.rotation.x = -0.38 + Math.sin(time * 1.6) * 0.22;
        // Sometimes a thinking Minion scratches or readjusts its goggles.
        if (Math.sin(time * 0.8) > 0.85) a.limbs.rightArm.rotation.z = 2.05;
      } else if (st.act === 'dance') {
        a.limbs.leftArm.rotation.z = -2.3 + Math.sin(time * 9) * 0.18;
        a.limbs.rightArm.rotation.z = 2.3 - Math.sin(time * 9) * 0.18;
        a.limbs.leftLeg.rotation.x = Math.sin(time * 8) * 0.25;
        a.limbs.rightLeg.rotation.x = -a.limbs.leftLeg.rotation.x;
      } else if (st.act === 'chat') {
        a.limbs.rightArm.rotation.z = 2.0 + Math.sin(time * 6) * 0.2;
      } else if (st.act === 'inspect') {
        a.limbs.rightArm.rotation.x = -1.15 + Math.sin(time * 3) * 0.14;
      } else if (st.act === 'stretch') {
        a.limbs.leftArm.rotation.z = -2.5;
        a.limbs.rightArm.rotation.z = 2.5;
      } else if (st.act === 'read') {
        a.limbs.leftArm.rotation.x = -0.65 + Math.sin(time * 0.8) * 0.08;
        a.limbs.rightArm.rotation.x = -0.65 - Math.sin(time * 0.8) * 0.08;
      } else if (st.act === 'coffee' || st.act === 'water') {
        a.limbs.rightArm.rotation.x = -0.9 + Math.sin(time * 1.1) * 0.13;
      } else if (st.act === 'arcade' || st.act === 'whiteboard') {
        a.limbs.rightArm.rotation.x = -0.8 + Math.sin(time * 7) * 0.25;
      } else {
        a.limbs.leftArm.rotation.x = Math.sin(time * 0.72) * 0.12;
        a.limbs.rightArm.rotation.x = -Math.sin(time * 0.72) * 0.12;
        if (status === 'idle' && !st.act && Math.sin(time * 0.58) > 0.93) {
          for (const other of this.people.values()) {
            if (other !== p && other.s?.status !== 'waiting' &&
                Math.hypot(other.x - p.x, other.y - p.y) < 2.2) {
              a.limbs.rightArm.rotation.z = 2.2 + Math.sin(time * 8) * 0.13;
              break;
            }
          }
        }
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
      const screen = cube(g, 0, 1.08, -0.625, 0.67, 0.38, 0.03,
        mat('#42d9c7', 0.34, 0.05, '#23c8d4'));
      const leds = [];
      for (let i = 0; i < 4; i++) {
        leds.push(ball(g, -0.27 + i * 0.18, 0.81, -0.29, 0.035,
          mat(i % 2 ? '#f9cf49' : '#60f0e2', 0.5, 0, i % 2 ? '#f9cf49' : '#60f0e2')));
      }
      this.labFx.consoles.push({ screen, leds, x: p.x, y: p.y, phase: p.x * 0.6, status: null });
    } else if (p.special === 'tank') {
      const h = p.h || 1.6, radius = p.r || 0.5;
      const liquid = tube(g, 0, h / 2, 0, radius, h, mat(p.liquid || '#82e59b', 0.22, 0.2, p.liquid || '#82e59b'));
      tube(g, 0, 0.075, 0, radius + 0.09, 0.15, steel);
      tube(g, 0, h + 0.06, 0, radius + 0.09, 0.12, steel);
      const bubbles = [];
      for (let i = 0; i < 5; i++) bubbles.push(ball(g,
        Math.sin(i * 2.1) * radius * 0.32,
        0.25 + (i * 0.29) % Math.max(0.45, h - 0.5),
        Math.cos(i * 2.1) * radius * 0.3, 0.047 + i % 2 * 0.017, glass));
      this.labFx.tanks.push({ bubbles, liquid, h, phase: p.x });
    } else if (p.special === 'rocket') {
      tube(g, 0, 1.05, 0, 0.43, 1.95, mat('#e4edf0', 0.35, 0.25));
      mesh(new ConeGeometry(0.43, 0.83, 20), yellowLight, g, 0, 2.45, 0);
      ball(g, 0, 1.46, 0.43, 0.23, steel);
      ball(g, 0, 1.46, 0.555, 0.155, mintLight);
      for (const side of [-1, 1]) cube(g, side * 0.47, 0.42, 0, 0.22, 0.8, 0.38, denim);
      tube(g, 0, 0.11, 0, 0.31, 0.2, dark);
      const flame = mesh(new ConeGeometry(0.18, 0.34, 10), mat('#ffad35', 0.3, 0, '#ff9d27'), g, 0, 0.24, 0);
      flame.visible = false;
      this.labFx.rockets.push({ flame, phase: p.y * 0.2 });
    } else if (p.special === 'conveyor') {
      const w = p.w || 2.5, h = p.h || 0.75, d = p.d || 0.7;
      cube(g, w / 2, h / 2, 0, w, h, d, mat('#58758a'));
      cube(g, w / 2, h + 0.035, 0, w, 0.07, d + 0.06, dark);
      const bananas = [];
      for (let i = 0; i < 3; i++) {
        const fruit = ball(g, 0.25 + i * 0.72, h + 0.17, 0, 0.18, yellowLight, 1.2, 0.46, 0.65);
        bananas.push(fruit);
      }
      this.labFx.conveyors.push({ bananas, w, h });
    } else if (p.special === 'drone') {
      const drone = new Group();
      g.add(drone);
      drone.position.y = p.height || 1.75;
      ball(drone, 0, 0, 0, 0.19, steel, 1.3, 0.6, 0.8);
      ball(drone, 0, -0.04, 0.17, 0.055, mintLight);
      const rotors = [];
      for (const side of [-1, 1]) {
        cube(drone, side * 0.35, 0, 0, 0.42, 0.05, 0.075, steel);
        const rotor = new Group();
        rotor.position.set(side * 0.56, 0.06, 0);
        cube(rotor, 0, 0, 0, 0.48, 0.017, 0.055, glass);
        cube(rotor, 0, 0, 0, 0.055, 0.017, 0.48, glass);
        drone.add(rotor);
        rotors.push(rotor);
      }
      this.labFx.drones.push({ obj: drone, rotors, height: p.height || 1.75, range: p.range || 1.5 });
    } else if (p.special === 'vent') {
      cube(g, 0, 0.075, 0, 0.48, 0.15, 0.4, steel);
      const steam = [];
      for (let i = 0; i < 5; i++) {
        const cloud = ball(g, 0, 0.35, 0, 0.085 + i * 0.012,
          new MeshBasicMaterial({ color: '#d6f6ff', transparent: true, opacity: 0.32, depthWrite: false }));
        cloud.castShadow = false;
        steam.push(cloud);
      }
      this.labFx.vents.push({ steam });
    } else if (p.special === 'banana-bot') {
      const robot = new Group();
      g.add(robot);
      ball(robot, 0, 0.25, 0, 0.22, yellowLight, 1.25, 0.7, 0.8);
      ball(robot, 0, 0.29, 0.19, 0.07, glass);
      for (const side of [-1, 1]) tube(robot, side * 0.16, 0.09, 0, 0.07, 0.13, boots);
      this.labFx.bots.push({ obj: robot, range: p.range || 1 });
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
