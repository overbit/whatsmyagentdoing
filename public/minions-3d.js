// Minions-themed 3D character layer. Uses the bundled renderer's own Three.js
// constructors, so the package remains self-contained and works offline.
import { Office3D as BaseOffice3D } from '/office3d.js';

const YELLOW = 0xffd83a;
const DENIM = 0x2d61ae;
const DARK = 0x202638;
const SILVER = 0xb8c6d1;
const WHITE = 0xfffdf3;
const BROWN = 0x5b402b;

export class Office3D extends BaseOffice3D {
  build() {
    super.build();
    if (this.plan.scene) return;
    // Bright, playful laboratory rather than a corporate office.
    const colors = new Map([
      [0xe3cfb0, 0xffe89c], [0x4a3f35, 0x39466b],
      [0xc9d3dc, 0x8fb9d9], [0x33404d, 0x364b70],
      [0xf4efe6, 0xfff0b9], [0x4a4640, 0x38466c],
      [0xbfd8c4, 0x85b9c9], [0x2f4a3a, 0x3a648a],
    ]);
    this.room.traverse((part) => {
      if (!part.isMesh || !part.material || Array.isArray(part.material)) return;
      const mat = part.material;
      // Only recolor single-color primitives; keep model textures and
      // screen/status colors intact. Clone shared materials before editing.
      if (mat.map || !mat.color || !colors.has(mat.color.getHex())) return;
      part.material = mat.clone();
      part.material.color.setHex(colors.get(mat.color.getHex()));
    });
  }

  actorFor(person) {
    const actor = super.actorFor(person);
    if (actor.minion) return actor;
    // Ball + room primitives provide SphereGeometry, BoxGeometry and Mesh
    // without importing a second copy of the heavy Three.js bundle.
    let ball = this.ball;
    if (!this.room) return actor;
    // Scene packs may not have the office's ping-pong ball. Find another
    // sphere in the imported set dressing, or a live actor's 3D equipment.
    if (!ball) this.room.traverse((part) => {
      if (!ball && part.isMesh && part.geometry?.type === 'SphereGeometry') ball = part;
    });
    if (!ball) return actor;
    let sampleBox = null;
    this.room.traverse((part) => {
      if (!sampleBox && part.isMesh && part.geometry?.type === 'BoxGeometry') sampleBox = part;
    });
    if (!sampleBox) return actor;

    const Mesh = ball.constructor;
    const Sphere = ball.geometry.constructor;
    const Box = sampleBox.geometry.constructor;
    const Material = (Array.isArray(ball.material) ? ball.material[0] : ball.material).constructor;
    const Group = actor.prop.constructor;
    const root = new Group();
    root.name = 'Minion character';

    // Preserve the invisible skeleton so the original mixers, positioning,
    // states, seating, and hand-held props continue to function.
    actor.obj.traverse((part) => {
      if (part.isMesh) part.visible = false;
    });

    const scale = 1 / actor.obj.scale.x;
    root.scale.setScalar(scale);
    const mat = (color, metalness = 0) => new Material({ color, roughness: 0.72, metalness });
    const skin = mat(YELLOW);
    const blue = mat(DENIM);
    const dark = mat(DARK);
    const silver = mat(SILVER, 0.65);
    const white = mat(WHITE);
    const brown = mat(BROWN);

    const orb = (parent, x, y, z, rx, ry, rz, material) => {
      const mesh = new Mesh(new Sphere(1, 16, 12), material);
      mesh.position.set(x, y, z);
      mesh.scale.set(rx, ry, rz);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const cube = (parent, x, y, z, w, h, d, material) => {
      const mesh = new Mesh(new Box(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // A recognisable silhouette from any camera angle: yellow capsule,
    // denim overalls, goggle strap and either one or two silver goggles.
    orb(root, 0, 0.47, 0, 0.215, 0.35, 0.205, skin);
    orb(root, 0, 0.29, 0.007, 0.218, 0.17, 0.208, blue);
    cube(root, 0, 0.43, 0.185, 0.27, 0.21, 0.065, blue);
    cube(root, -0.137, 0.48, 0.108, 0.052, 0.16, 0.07, blue);
    cube(root, 0.137, 0.48, 0.108, 0.052, 0.16, 0.07, blue);
    cube(root, 0, 0.34, 0.236, 0.14, 0.09, 0.025, blue);
    cube(root, 0, 0.30, 0.253, 0.07, 0.046, 0.012, dark);
    cube(root, 0, 0.64, 0.184, 0.43, 0.075, 0.045, dark);

    const double = person.h % 3 !== 0;
    const eyeCenters = double ? [-0.095, 0.095] : [0];
    for (const ex of eyeCenters) {
      const radius = double ? 0.112 : 0.143;
      orb(root, ex, 0.64, 0.213, radius, radius, 0.068, silver);
      orb(root, ex, 0.64, 0.264, radius * 0.76, radius * 0.76, 0.036, white);
      orb(root, ex, 0.633, 0.295, 0.027, 0.032, 0.012, brown);
      orb(root, ex + 0.005, 0.635, 0.307, 0.012, 0.014, 0.006, dark);
    }
    orb(root, 0, 0.507, 0.208, 0.055, 0.012, 0.013, brown);

    for (const x of [-0.105, 0.105]) {
      cube(root, x, 0.095, 0, 0.085, 0.16, 0.105, blue);
      orb(root, x, 0.045, 0.064, 0.085, 0.047, 0.12, dark);
    }
    const arms = [];
    for (const side of [-1, 1]) {
      const pivot = new Group();
      pivot.position.set(side * 0.225, 0.465, 0);
      orb(pivot, side * 0.045, -0.11, 0, 0.068, 0.14, 0.068, skin);
      orb(pivot, side * 0.055, -0.235, 0.012, 0.073, 0.075, 0.071, dark);
      root.add(pivot);
      arms.push(pivot);
    }
    const hairs = 1 + person.h % 3;
    for (let i = 0; i < hairs; i++) {
      const x = (i - (hairs - 1) / 2) * 0.06;
      const tuft = cube(root, x, 0.826, 0, 0.012, 0.10, 0.012, dark);
      tuft.rotation.z = x ? x * 2 : -0.15;
    }

    actor.obj.add(root);
    actor.minion = { root, arms };
    return actor;
  }

  syncActors(dt) {
    super.syncActors(dt);
    for (const person of this.people.values()) {
      const actor = this.actors.get(person.key);
      if (!actor?.minion) continue;
      const state = this.stateOf(person);
      const t = this.t / 1000 + person.phase;
      const walk = state.pose === 'walk';
      const wave = state.act === 'wave';
      const type = state.act === 'type';
      actor.minion.arms[0].rotation.z = walk ? Math.sin(t * 10) * 0.5 : type ? Math.sin(t * 17) * 0.1 : 0.15;
      actor.minion.arms[1].rotation.z = wave ? -2.4 + Math.sin(t * 9) * 0.3 : walk ? -Math.sin(t * 10) * 0.5 : type ? -Math.sin(t * 17) * 0.1 : -0.15;
      actor.minion.root.rotation.z = walk ? Math.sin(t * 10) * 0.035 : 0;
    }
  }
}
