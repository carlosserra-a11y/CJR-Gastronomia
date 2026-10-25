/* ============================================================
   Cena 3D do topo (three.js): utensílios de inox, ervas e
   temperos flutuando ao redor da foto principal — tudo modelado
   em código, sem arquivos externos.
   - mouse: a cena inclina e cada peça se desloca pela profundidade
   - rolagem: as peças se afastam e giram
   - clique: as peças "pulam"
   Empacotado em js/site/kitchen3d.js (npm run build:3d).
   O laço de animação é o do site (motion.js): ele chama render().
   ============================================================ */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Object3D, Color,
  MeshStandardMaterial, MeshPhysicalMaterial, Shape, ExtrudeGeometry, ShapeGeometry, SphereGeometry,
  CylinderGeometry, IcosahedronGeometry, BoxGeometry, CapsuleGeometry, CanvasTexture,
  DirectionalLight, AmbientLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, DoubleSide, MathUtils,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const between = (a, b) => a + (b - a) * rand();

/* ---------------- Materiais ---------------- */
function materials() {
  return {
    steel: new MeshStandardMaterial({ color: 0xdfe3e7, metalness: 1, roughness: 0.18 }),
    handle: new MeshStandardMaterial({ color: 0x1b1a18, metalness: 0.2, roughness: 0.45 }),
    basil: new MeshStandardMaterial({ color: 0x3e7a35, roughness: 0.5, side: DoubleSide }),
    herb: new MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.6 }),
    stem: new MeshStandardMaterial({ color: 0x6b6a3a, roughness: 0.7 }),
    tomato: new MeshPhysicalMaterial({ color: 0xd2301f, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    calyx: new MeshStandardMaterial({ color: 0x4b7d2e, roughness: 0.6, side: DoubleSide }),
    pepper: new MeshStandardMaterial({ color: 0x2b211b, roughness: 0.85 }),
    salt: new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.92 }),
  };
}

/* ---------------- Peças ---------------- */
function knife(m) {
  const g = new Group();
  const s = new Shape();
  s.moveTo(0, 0); s.lineTo(2.1, 0); s.quadraticCurveTo(2.55, 0.02, 2.62, 0.3); s.lineTo(0, 0.42); s.lineTo(0, 0);
  const blade = new Mesh(new ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }), m.steel);
  blade.position.set(0.05, -0.21, -0.01);
  const bolster = new Mesh(new CylinderGeometry(0.12, 0.12, 0.1, 24), m.steel);
  bolster.rotation.z = Math.PI / 2;
  const handle = new Mesh(new CapsuleGeometry(0.13, 1.05, 6, 16), m.handle);
  handle.rotation.z = Math.PI / 2; handle.position.x = -0.66;
  g.add(blade, bolster, handle);
  return g;
}

function fork(m) {
  const s = new Shape();
  // cabo + pescoço + cabeça com 4 dentes
  s.moveTo(-1.6, -0.09); s.lineTo(0.2, -0.05); s.quadraticCurveTo(0.5, -0.05, 0.62, -0.22);
  const tine = 0.07, gap = 0.043, top = 1.32;
  let y = -0.22;
  for (let i = 0; i < 4; i++) {
    s.lineTo(top, y); s.lineTo(top, y + tine); s.lineTo(0.85, y + tine);
    y += tine + gap;
    if (i < 3) s.lineTo(0.85, y);
  }
  s.lineTo(0.62, 0.22); s.quadraticCurveTo(0.5, 0.05, 0.2, 0.05); s.lineTo(-1.6, 0.09);
  s.quadraticCurveTo(-1.72, 0, -1.6, -0.09);
  const mesh = new Mesh(new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 10 }), m.steel);
  const g = new Group(); g.add(mesh);
  return g;
}

function spoon(m) {
  const g = new Group();
  const bowl = new Mesh(new SphereGeometry(0.42, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), m.steel);
  bowl.scale.set(1.45, 0.28, 1); bowl.rotation.x = Math.PI; bowl.position.x = 0.95;
  const s = new Shape();
  s.moveTo(-1.5, -0.1); s.lineTo(0.4, -0.05); s.lineTo(0.55, 0); s.lineTo(0.4, 0.05); s.lineTo(-1.5, 0.1);
  s.quadraticCurveTo(-1.64, 0, -1.5, -0.1);
  const handle = new Mesh(new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2 }), m.steel);
  handle.rotation.x = Math.PI / 2; handle.position.y = 0.02;
  g.add(bowl, handle);
  g.rotation.x = -Math.PI / 2; // de frente para a câmera
  const wrap = new Group(); wrap.add(g);
  return wrap;
}

function basil(m, size = 1) {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.35, 0.18, 0.62, 0.55, 0, 1.25);
  s.bezierCurveTo(-0.62, 0.55, -0.35, 0.18, 0, 0);
  const geo = new ShapeGeometry(s, 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { // folha arqueada (dobra no centro e na ponta)
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, -0.22 * x * x * 3 + 0.18 * Math.sin(y * 2.2));
  }
  geo.computeVertexNormals();
  const leaf = new Mesh(geo, m.basil);
  leaf.scale.setScalar(size);
  const g = new Group(); g.add(leaf);
  return g;
}

function tomato(m) {
  const g = new Group();
  const body = new Mesh(new SphereGeometry(0.3, 40, 28), m.tomato);
  body.scale.y = 0.88;
  const star = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.05 : 0.2;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const calyx = new Mesh(new ShapeGeometry(star), m.calyx);
  calyx.rotation.x = -Math.PI / 2; calyx.position.y = 0.262;
  const stem = new Mesh(new CylinderGeometry(0.015, 0.02, 0.12, 8), m.calyx);
  stem.position.y = 0.32;
  g.add(body, calyx, stem);
  return g;
}

function peppercorn(m) {
  const geo = new IcosahedronGeometry(0.075, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { // casca enrugada
    const k = 1 + 0.12 * Math.sin(pos.getX(i) * 60) * Math.cos(pos.getY(i) * 55);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return new Mesh(geo, m.pepper);
}

function rosemary(m) {
  const g = new Group();
  const len = 1.7;
  const stem = new Mesh(new CylinderGeometry(0.018, 0.026, len, 8), m.stem);
  g.add(stem);
  const count = 46;
  const needles = new InstancedMesh(new BoxGeometry(0.26, 0.032, 0.014), m.herb, count);
  const d = new Object3D();
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const y = -len / 2 + 0.08 + t * (len - 0.14);
    const side = i % 2 ? 1 : -1;
    const around = i * 2.399; // ângulo de ouro: distribui em volta do caule
    d.position.set(Math.cos(around) * 0.1 * side, y, Math.sin(around) * 0.1);
    d.rotation.set(0, -around, side * 0.55 + (1 - t) * 0.2);
    d.scale.setScalar(0.75 + 0.35 * Math.sin(t * Math.PI));
    d.updateMatrix();
    needles.setMatrixAt(i, d.matrix);
  }
  g.add(needles);
  return g;
}

function lemonSlice() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#f2d64b"; x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#fbf2c6"; x.beginPath(); x.arc(128, 128, 112, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 9; i++) { // gomos
    const a0 = (i / 9) * Math.PI * 2 + 0.05, a1 = ((i + 1) / 9) * Math.PI * 2 - 0.05;
    x.fillStyle = i % 2 ? "#f6dd5c" : "#f3d34a";
    x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 104, a0, a1); x.closePath(); x.fill();
  }
  x.fillStyle = "#fbf2c6"; x.beginPath(); x.arc(128, 128, 12, 0, Math.PI * 2); x.fill();
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
  const face = new MeshStandardMaterial({ map: tex, roughness: 0.45 });
  const rind = new MeshStandardMaterial({ color: 0xe9c72e, roughness: 0.5 });
  const mesh = new Mesh(new CylinderGeometry(0.42, 0.42, 0.06, 48), [rind, face, face]);
  mesh.rotation.x = Math.PI / 2;
  const g = new Group(); g.add(mesh);
  return g;
}

/* ---------------- Composição ---------------- */
// Posições em fração da metade da tela visível (x: -1 esquerda … 1 direita; y: -1 baixo … 1 topo).
// No computador o texto ocupa a esquerda e a foto fica em torno de x ≈ 0.45.
// `m` é a posição no celular: lá o texto ocupa a largura toda, então só alguns objetos espiam pelas bordas.
const LAYOUT = [
  { make: "knife", fx: 0.5, fy: -0.84, z: 1.6, rot: [0.25, 0.4, 0.22], s: 0.95, spin: 0.15, m: [0.78, -0.9] },
  { make: "fork", fx: 0.86, fy: 0.62, z: 1.1, rot: [-0.3, -0.3, -0.85], s: 0.9, spin: -0.12 },
  { make: "spoon", fx: 0.92, fy: -0.66, z: 0.8, rot: [0.6, 0.2, 2.4], s: 0.85, spin: 0.1, m: [-1.02, -0.62] },
  { make: "basil", fx: 0.2, fy: 0.6, z: 1.4, rot: [0.6, 0.3, -0.4], s: 0.7, spin: 0.3, m: [-1.05, 0.3] },
  { make: "basil", fx: 0.74, fy: -0.25, z: 2.2, rot: [-0.4, 0.8, 1.9], s: 0.55, spin: -0.25 },
  { make: "basil", fx: 0.98, fy: 0.12, z: 0.4, rot: [0.2, -0.6, 2.8], s: 0.6, spin: 0.2, m: [1.05, 0.05] },
  { make: "tomato", fx: 0.3, fy: -0.15, z: 1.9, rot: [0.4, 0, 0.2], s: 0.9, spin: 0.35, m: [1.02, 0.86] },
  { make: "tomato", fx: 0.1, fy: -0.8, z: 1.3, rot: [-0.3, 0, -0.4], s: 0.75, spin: -0.3, m: [-0.98, -0.2] },
  { make: "tomato", fx: 0.95, fy: 0.85, z: -0.2, rot: [0.9, 0, 0.6], s: 0.8, spin: 0.25 },
  { make: "rosemary", fx: 0.5, fy: 0.84, z: 0.9, rot: [0.2, 0.4, 1.2], s: 0.8, spin: 0.12, m: [1.06, 0.48] },
  { make: "rosemary", fx: -0.15, fy: -0.88, z: 0.2, rot: [0.5, 0.2, -1.1], s: 0.7, spin: -0.1 },
  { make: "lemon", fx: 0.7, fy: 0.32, z: 2.4, rot: [0.5, -0.7, 0.3], s: 0.75, spin: 0.2, m: [1.04, -0.45] },
];
const MOBILE_SCALE = 0.62;

/** Posição de um grão de tempero: fora do bloco de texto (esquerda no computador, miolo no celular). */
function grainSpot(mobile) {
  if (mobile) return { fx: (rand() > 0.5 ? 1 : -1) * between(0.86, 1.04), fy: between(-1, 1) };
  if (rand() < 0.8) return { fx: between(0.05, 1.05), fy: between(-1, 1) };
  return { fx: between(-0.9, 0.05), fy: between(0.86, 1) }; // acima do título, nunca sobre os números
}

export function mountKitchen(canvas, { mobile = false } = {}) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new DirectionalLight(new Color(0xfff1dc), 1.6);
  sun.position.set(-4, 6, 8);
  scene.add(sun, new AmbientLight(0xffffff, 0.35));

  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 11);

  const m = materials();
  const makers = { knife: () => knife(m), fork: () => fork(m), spoon: () => spoon(m), basil: () => basil(m), tomato: () => tomato(m), rosemary: () => rosemary(m), lemon: () => lemonSlice() };
  const world = new Group();
  scene.add(world);

  const items = LAYOUT.filter((def) => !mobile || def.m).map((def, i) => {
    const obj = makers[def.make]();
    obj.scale.setScalar(def.s * (mobile ? MOBILE_SCALE : 1));
    obj.rotation.set(...def.rot);
    world.add(obj);
    return { obj, def, phase: i * 1.37, vel: 0, base: { rx: def.rot[0], ry: def.rot[1], rz: def.rot[2] }, kick: 0 };
  });

  // Temperos miúdos espalhados por toda a área (pimenta e sal), em várias profundidades
  const grains = [];
  const grainCount = mobile ? 10 : 26;
  for (let i = 0; i < grainCount; i++) {
    const isSalt = i % 3 === 0;
    const mesh = isSalt ? new Mesh(new BoxGeometry(0.09, 0.09, 0.09), m.salt) : peppercorn(m);
    mesh.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    if (mobile) mesh.scale.setScalar(MOBILE_SCALE);
    world.add(mesh);
    grains.push({ obj: mesh, ...grainSpot(mobile), z: between(-2.5, 3), phase: rand() * 6, spin: between(-0.6, 0.6) });
  }

  let halfW = 1, halfH = 1;
  function resize(w, h) {
    renderer.setSize(Math.max(1, w), Math.max(1, h), false);
    camera.aspect = Math.max(1, w) / Math.max(1, h);
    camera.updateProjectionMatrix();
    halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfW = halfH * camera.aspect;
  }

  let impulse = 0;
  const jump = () => { impulse = 1; for (const it of items) it.vel += between(1.5, 3) * (rand() > 0.5 ? 1 : -1); };

  let rx = 0, ry = 0;
  function render({ time, mx = 0.5, my = 0.5, scroll = 0, dt = 16 }) {
    const k = 1 - Math.pow(0.9, dt / 16);
    ry += ((mx - 0.5) * 0.35 - ry) * k;
    rx += ((my - 0.5) * 0.22 - rx) * k;
    world.rotation.set(rx, ry, 0);
    impulse *= Math.pow(0.92, dt / 16);
    const spread = Math.min(1.4, Math.max(0, scroll));

    for (const it of items) {
      const { def, obj } = it;
      const [fx, fy] = mobile ? def.m : [def.fx, def.fy];
      const bob = Math.sin(time * 0.8 + it.phase) * 0.12;
      const dirX = Math.sign(fx - 0.45) || 1, dirY = Math.sign(fy) || 1;
      obj.position.set(
        fx * halfW + dirX * spread * 2.2 + (mx - 0.5) * def.z * 0.25,
        fy * halfH + bob + dirY * spread * 1.6 + impulse * 0.5 * Math.sin(it.phase) - (my - 0.5) * def.z * 0.15,
        def.z,
      );
      it.vel *= Math.pow(0.94, dt / 16);
      it.kick += it.vel * (dt / 1000);
      obj.rotation.set(
        it.base.rx + Math.sin(time * 0.5 + it.phase) * 0.12 + spread * def.spin * 3,
        it.base.ry + time * def.spin * 0.25 + it.kick,
        it.base.rz + Math.cos(time * 0.4 + it.phase) * 0.08 + spread * def.spin * 2,
      );
    }
    for (const g of grains) {
      g.obj.position.set(
        g.fx * halfW + (mx - 0.5) * g.z * 0.3,
        g.fy * halfH + Math.sin(time * 0.6 + g.phase) * 0.08 + spread * (g.fy > 0 ? 1.4 : -1.4) + impulse * 0.35,
        g.z,
      );
      g.obj.rotation.x += g.spin * (dt / 1000) * (1 + impulse * 6);
      g.obj.rotation.y += g.spin * 0.7 * (dt / 1000);
    }
    renderer.render(scene, camera);
  }

  // ao sair da página inicial: libera geometrias, materiais (inclusive os do limão, fora de `m`), texturas e o contexto WebGL
  function destroy() {
    const mats = new Set(Object.values(m));
    scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.isInstancedMesh) o.dispose(); // buffers das instâncias (agulhas do alecrim)
      [].concat(o.material || []).forEach((mat) => mats.add(mat));
    });
    mats.forEach((mat) => { mat.map?.dispose(); mat.dispose(); });
    scene.environment?.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { render, resize, jump, destroy };
}
