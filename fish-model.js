// fish-model.js — Peces realistas procedurales (sin texturas ni modelos externos)
// Namespace: FishModel  ·  Uso:  const f = FishModel.create({ species: 0..3, length: 0.6 });  scene.add(f.root);
// El pez mira hacia +Z local, el lomo hacia +Y. root.scale = largo del pez en metros.
// API del objeto devuelto:
//   root        THREE.Group (rotation.order = 'YXZ': yaw, pitch y "roll" para tumbarlo de lado)
//   length      largo en metros · halfWidth: medio grosor en metros (para apoyarlo de lado en la arena)
//   species     nombre de la especie ('lubina', 'pargo', 'caballa', 'dorada')
//   setSwim(t, amp)  ondulación de nado: t = fase (rad), amp = 0..2 (cuerpo, cola y aletas)
//   setTint(k)       0 = crudo · 1 = asado a las brasas (color de piel, ojos opacos)
import * as THREE from 'three';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- Especies ----------
// H = medio alto del cuerpo, W = medio ancho (relativos al largo = 1). Colores RGB 0-255.
export const SPECIES = [
  { name: 'lubina',  H: .125, W: .070, back: [34, 62, 80],  flank: [170, 184, 190], belly: [238, 240, 236], fin: [74, 90, 98],   stripes: false, gold: false, sheen: .16 },
  { name: 'pargo',   H: .158, W: .078, back: [152, 48, 46], flank: [214, 112, 102], belly: [248, 216, 202], fin: [190, 62, 54],  stripes: false, gold: false, sheen: .08 },
  { name: 'caballa', H: .102, W: .064, back: [18, 92, 100], flank: [150, 192, 198], belly: [240, 242, 234], fin: [36, 70, 84],   stripes: true,  gold: false, sheen: .14 },
  { name: 'dorada',  H: .142, W: .074, back: [50, 64, 78],  flank: [188, 194, 192], belly: [242, 240, 230], fin: [92, 94, 98],   stripes: false, gold: true,  sheen: .13 }
];

// ---------- Geometría del cuerpo ----------
const L_NOSE = .5, L_BODY = .86, Z_PED = L_NOSE - L_BODY;        // nariz en +.5, pedúnculo caudal en -.36
const zAt = t => L_NOSE - t * L_BODY, tAt = z => (L_NOSE - z) / L_BODY;
function prof(t) {                                               // 0 en la nariz, 1 en la zona más gruesa, ~.12 en el pedúnculo
  const head = Math.pow(Math.sin(Math.PI / 2 * clamp(t / .32, 0, 1)), .85);
  return head * (1 - .88 * sstep(.38, 1, t));
}

function buildBody(sp) {
  const N = 40, RAD = 26, pos = [], uv = [], idx = [], flap = [];
  for (let i = 0; i <= N; i++) {
    const t = Math.pow(i / N, 1.35), z = zAt(t), p = prof(t), hh = sp.H * p, hw = sp.W * p;
    for (let j = 0; j <= RAD; j++) {
      const a = j / RAD * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
      pos.push(hw * cx, cy > 0 ? hh * cy * 1.04 : hh * cy * .96, z);
      uv.push(j / RAD, t); flap.push(0);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < RAD; j++) {
    const a = i * (RAD + 1) + j, b = a + RAD + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFlap', new THREE.Float32BufferAttribute(flap, 1));
  g.setIndex(idx); g.computeVertexNormals();
  // Unir las normales de la costura (j = 0 y j = RAD) y cerrar la nariz
  const nr = g.attributes.normal;
  for (let i = 0; i <= N; i++) {
    const a = i * (RAD + 1), b = a + RAD;
    const nx = nr.getX(a) + nr.getX(b), ny = nr.getY(a) + nr.getY(b), nz = nr.getZ(a) + nr.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
    nr.setXYZ(a, nx / l, ny / l, nz / l); nr.setXYZ(b, nx / l, ny / l, nz / l);
  }
  for (let j = 0; j <= RAD; j++) nr.setXYZ(j, 0, 0, 1);
  return g;
}

// Aleta a partir de un polígono 2D (a = a lo largo de la base, b = alejándose de la base) y una función a 3D.
function buildFin(pts, center, to3d, flapFn) {
  let amin = 1e9, amax = -1e9, bmin = 1e9, bmax = -1e9;
  for (const [a, b] of pts.concat([center])) { amin = Math.min(amin, a); amax = Math.max(amax, a); bmin = Math.min(bmin, b); bmax = Math.max(bmax, b); }
  const all = [center].concat(pts), pos = [], uv = [], flap = [], idx = [];
  for (const [a, b] of all) {
    const p = to3d(a, b); pos.push(p[0], p[1], p[2]);
    uv.push((a - amin) / (amax - amin || 1), (b - bmin) / (bmax - bmin || 1));
    flap.push(flapFn ? flapFn(a, b) : 0);
  }
  for (let i = 1; i < all.length - 1; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFlap', new THREE.Float32BufferAttribute(flap, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildFins(sp) {
  const H = sp.H, W = sp.W;
  const top = z => H * prof(clamp(tAt(z), 0, 1)) * 1.04, bot = z => H * prof(clamp(tAt(z), 0, 1)) * .96, wid = z => W * prof(clamp(tAt(z), 0, 1));
  const kD = sp.name === 'caballa' ? 1.05 : sp.name === 'pargo' ? 1.15 : 1;
  const fins = {};
  fins.dorsal = buildFin(
    [[.16, -.012], [.115, .05 * kD], [.075, .125 * kD], [.03, .115 * kD], [-.02, .085 * kD], [-.07, .045 * kD], [-.105, .015], [-.12, -.012]],
    [.02, -.014], (z, h) => [0, top(z) + h, z]);
  fins.dorsal2 = buildFin(
    [[-.185, -.012], [-.2, .04], [-.245, .068], [-.295, .048], [-.315, -.008]],
    [-.25, -.014], (z, h) => [0, top(z) + h, z]);
  fins.anal = buildFin(
    [[-.10, -.012], [-.125, .05], [-.17, .088], [-.23, .072], [-.275, .042], [-.29, -.006]],
    [-.19, -.014], (z, d) => [0, -bot(z) - d, z]);
  // Cola ahorquillada (a = altura y, b = distancia hacia atrás)
  const zP = Z_PED + .012, tl = sp.name === 'caballa' ? 1.12 : 1;
  fins.caudal = buildFin(
    [[.028, 0], [.09, .07], [.17 * tl, .205], [.07, .15], [.03, .118], [0, .103], [-.03, .118], [-.07, .15], [-.17 * tl, .205], [-.09, .07], [-.028, 0]],
    [0, 0], (y, dz) => [0, y, zP - dz]);
  // Pectorales (s = hacia atrás, r = hacia afuera)
  const pec = side => {
    const z0 = .255, y0 = -H * .34, w0 = wid(z0) * .92;
    return buildFin(
      [[0, 0], [0, .03], [.016, .09], [.05, .142], [.096, .12], [.122, .052], [.092, 0]],
      [.05, 0], (s, r) => [side * (w0 + r * .93), y0 - r * .30, z0 - s - r * .55], (s, r) => side * r / .142);
  };
  fins.pecL = pec(1); fins.pecR = pec(-1);
  const pel = side => {
    const z0 = .125, y0 = -bot(z0) * .92, w0 = wid(z0) * .42;
    return buildFin(
      [[0, 0], [0, .02], [.012, .07], [.05, .102], [.075, .05], [.062, 0]],
      [.03, 0], (s, r) => [side * (w0 + r * .55), y0 - r * .80, z0 - s - r * .6], (s, r) => side * r / .1);
  };
  fins.pelL = pel(1); fins.pelR = pel(-1);
  return fins;
}

// ---------- Texturas procedurales ----------
function makeSkin(sp, seed) {
  const w = 512, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, rnd = mulberry32(seed);
  const NU = 96, NT = 64, T2 = Math.PI * 2;
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / w, a = u * T2, lat = Math.sin(a);                 // lat = +1 lomo · -1 vientre
      const dorsal = sstep(.28, .74, lat), ventral = sstep(-.05, -.55, lat);
      let r = lerp(sp.flank[0], sp.back[0], dorsal), gc = lerp(sp.flank[1], sp.back[1], dorsal), b = lerp(sp.flank[2], sp.back[2], dorsal);
      r = lerp(r, sp.belly[0], ventral); gc = lerp(gc, sp.belly[1], ventral); b = lerp(b, sp.belly[2], ventral);
      // brillo plateado del flanco
      const sh = Math.exp(-Math.pow((lat - .0) / .38, 2)) * sp.sheen * sstep(.10, .3, t);
      r += 255 * sh * .55; gc += 255 * sh * .55; b += 255 * sh * .55;
      // escamas (filas escalonadas)
      const row = t * NT, ri = Math.floor(row), fy = row - ri;
      const sx = u * NU + ((ri & 1) ? .5 : 0), cu = Math.floor(sx), fx = sx - cu;
      const px = fx - .5, py = fy - .30, rr = Math.sqrt(px * px * 1.1 + py * py * .9);
      const scaleVis = sstep(.20, .34, t) * (1 - ventral * .45);
      const hv = ((Math.imul(ri * 73856093 ^ cu * 19349663, 83492791) >>> 0) % 1000) / 1000 - .5;
      let k = 1 - sstep(.44, .66, rr) * .20 * scaleVis + sstep(0, .34, .5 - rr) * .10 * scaleVis + hv * .07 * scaleVis;
      // línea lateral
      const ll = Math.exp(-Math.pow((lat - .12 - .025 * Math.sin(t * 6)) / .022, 2)) * sstep(.24, .32, t) * (1 - sstep(.9, 1, t));
      k *= 1 - ll * .30;
      // opérculo (placa de las agallas)
      const gill = Math.exp(-Math.pow((t - (.236 - .022 * lat)) / .007, 2)) * (lat > -.6 ? 1 : .4);
      k *= 1 - gill * .50;
      if (t > .115 && t < .236) k *= 1.04;
      // aletas: rayas oscuras (caballa)
      if (sp.stripes) {
        const s = Math.sin(t * 95 + 2.2 * Math.sin(a * 2 + t * 10) + lat * 7);
        const m = sstep(.45, .85, s) * sstep(.12, .5, lat) * sstep(.22, .30, t) * .88;
        r = lerp(r, 14, m); gc = lerp(gc, 38, m); b = lerp(b, 48, m);
      }
      if (sp.gold) {
        const gd = Math.exp(-Math.pow((t - .14) / .075, 2)) * sstep(.20, .6, lat);
        r = lerp(r, 212, gd * .85); gc = lerp(gc, 168, gd * .85); b = lerp(b, 58, gd * .85);
        const s2 = Math.pow(Math.sin(lat * 55) * .5 + .5, 7) * sstep(.25, .35, t) * sstep(.35, .1, lat) * sstep(-.45, -.2, lat);
        r += 38 * s2; gc += 28 * s2; b -= 8 * s2;
        const sp2 = Math.exp(-(Math.pow((t - .252) / .034, 2) + Math.pow((lat - .18) / .2, 2)));
        k *= 1 - sp2 * .55;
      }
      k *= 1 + (rnd() - .5) * .05;
      const i = (y * w + x) * 4;
      d[i] = clamp(r * k, 0, 255); d[i + 1] = clamp(gc * k, 0, 255); d[i + 2] = clamp(b * k, 0, 255); d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

function makeFinTex(sp, seed) {
  const w = 128, h = 96, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, rnd = mulberry32(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;                                  // v = 0 en la base de la aleta
    const ang = Math.atan2(u - .5, v * 1.2 + .12), ray = .5 + .5 * Math.cos(ang * 36);
    const edge = sstep(.80, 1.0, v + (rnd() - .5) * .12) + sstep(.40, .5, Math.abs(u - .5) + v * .15 + (rnd() - .5) * .05) * .5;
    const alpha = (.66 + .34 * ray) * (1 - clamp(edge, 0, 1));
    const mem = .08 + .08 * rnd(), tip = sstep(.5, 1, v) * .30;
    const cr = lerp(sp.fin[0], 255, mem) * (.82 + .3 * ray) * (1 - tip), cg = lerp(sp.fin[1], 255, mem) * (.82 + .3 * ray) * (1 - tip), cb = lerp(sp.fin[2], 255, mem) * (.82 + .3 * ray) * (1 - tip);
    const i = (y * w + x) * 4;
    d[i] = clamp(cr, 0, 255); d[i + 1] = clamp(cg, 0, 255); d[i + 2] = clamp(cb, 0, 255); d[i + 3] = alpha * 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;
  return tex;
}

// ---------- Recursos compartidos por especie ----------
const cache = new Map();
let eyeGeo = null, pupilGeo = null;
function resources(i) {
  if (cache.has(i)) return cache.get(i);
  const sp = SPECIES[i];
  if (!eyeGeo) { eyeGeo = new THREE.SphereGeometry(.0185, 14, 10); pupilGeo = new THREE.SphereGeometry(.0112, 12, 8); }
  const r = { sp, body: buildBody(sp), fins: buildFins(sp), skin: makeSkin(sp, 1000 + i * 77), finTex: makeFinTex(sp, 2000 + i * 31) };
  cache.set(i, r); return r;
}

// Ondulación de nado en el vertex shader (cola) + aleteo de pectorales
function enableSwim(mat, swim) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSwimT = swim.t; sh.uniforms.uSwimA = swim.a;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFlap;uniform float uSwimT;uniform float uSwimA;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float swW=clamp((0.18-position.z)/0.62,0.0,1.0);swW*=swW;
        transformed.x+=sin(uSwimT-position.z*7.0)*uSwimA*0.085*swW;
        transformed.x+=sin(uSwimT*0.9+1.0)*uSwimA*0.012*clamp((0.5-position.z)*1.2,0.0,1.0);
        transformed.x+=aFlap*(0.012+0.022*uSwimA)*sin(uSwimT*1.3);`);
  };
  mat.customProgramCacheKey = () => 'fishswim-v1';
}

export function create(opts = {}) {
  const si = (opts.species != null ? opts.species : Math.floor(Math.random() * SPECIES.length)) % SPECIES.length;
  const R = resources(si), sp = R.sp, len = opts.length || .6;
  const swim = { t: { value: Math.random() * 6 }, a: { value: 0 } };
  const bodyMat = new THREE.MeshPhysicalMaterial({ map: R.skin, roughness: .34, metalness: .16, clearcoat: .55, clearcoatRoughness: .22 });
  const finMat = new THREE.MeshStandardMaterial({ map: R.finTex, alphaTest: .5, roughness: .72, side: THREE.DoubleSide });
  enableSwim(bodyMat, swim); enableSwim(finMat, swim);
  const irisMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(.86, .80, .58), roughness: .32, metalness: .5 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: .06, metalness: 0 });

  const root = new THREE.Group(); root.rotation.order = 'YXZ'; root.scale.setScalar(len);
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; root.add(m); return m; };
  add(R.body, bodyMat);
  for (const k of ['dorsal', 'dorsal2', 'anal', 'caudal', 'pecL', 'pecR', 'pelL', 'pelR']) add(R.fins[k], finMat);
  // Ojos
  const ez = .355, ew = sp.W * Math.pow(Math.sin(Math.PI / 2 * clamp(tAt(ez) / .32, 0, 1)), .85) * .86;
  for (const s of [1, -1]) {
    const e = add(eyeGeo, irisMat); e.position.set(s * ew, .014, ez);
    const p = add(pupilGeo, pupilMat); p.position.set(s * (ew + .0092), .014, ez + .0035);
  }
  const col = new THREE.Color();
  return {
    root, length: len, halfWidth: sp.W * len * 1.02, species: sp.name, speciesIndex: si, procedural: true,
    setSwim(t, amp) { swim.t.value = t; swim.a.value = amp; },
    setTint(k) {
      k = clamp(k, 0, 1);
      bodyMat.color.setRGB(lerp(1, .74, k), lerp(1, .50, k), lerp(1, .30, k));
      bodyMat.roughness = lerp(.34, .64, k); bodyMat.clearcoat = lerp(.55, .04, k);
      finMat.color.setRGB(lerp(1, .74, k), lerp(1, .56, k), lerp(1, .38, k));
      irisMat.color.setRGB(lerp(.86, .90, k), lerp(.80, .88, k), lerp(.58, .80, k)); irisMat.metalness = lerp(.5, .05, k);
      pupilMat.color.setRGB(lerp(.02, .30, k), lerp(.02, .28, k), lerp(.02, .26, k)); pupilMat.roughness = lerp(.06, .6, k);
    },
    update() { }
  };
}

export const FishModel = { SPECIES, create, count: SPECIES.length };
