// CUEVA MARINA CAMUFLADA EN MONTAÑA DE ARENA NATURAL:
// cascarón interior de arenisca con sus 3 aperturas abiertas (claraboya superior, arco al mar y hueco lateral)
// y piso de arena interior intacto sin paredes de arena dentro de la cueva.
function h2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vn(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h2(ix, iy) * (1 - u) + h2(ix + 1, iy) * u) * (1 - v) +
         (h2(ix, iy + 1) * (1 - u) + h2(ix + 1, iy + 1) * u) * v;
}
function fbm(x, y) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 5; i++) {
    s += a * vn(x, y);
    x = x * 2.03 + 11.7;
    y = y * 2.03 + 5.3;
    a *= 0.5;
  }
  return s;
}
const dAng = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

function rockTexture(THREE) {
  const N = 512, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const warp = fbm(x * 0.014, y * 0.022) * 9;
      const strata = Math.sin(y * 0.14 + warp) * 0.5 + 0.5;
      const fineStrata = Math.sin(y * 0.42 + warp * 1.4) * 0.5 + 0.5;
      const grain = fbm(x * 0.08, y * 0.08);
      const fine = h2(x, y);
      const pit = fbm(x * 0.04 + 40, y * 0.04) > 0.66 ? 0.75 : 1;
      let v = (122 + 58 * grain + 30 * strata + 14 * fineStrata + 18 * (fine - 0.5)) * pit;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(24, Math.min(255, v));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 75; i++) {
    const x = h2(i, 3) * N, y = h2(i, 9) * N;
    g.strokeStyle = `rgba(55,44,34,${0.14 + h2(i, 5) * 0.22})`;
    g.lineWidth = 0.7 + h2(i, 7) * 2.0;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 22, y + 32, x - 16, y + 65, x + 12, y + 105 + h2(i, 2) * 85);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  r.addColorStop(0, 'rgba(255,238,195,1)');
  r.addColorStop(0.5, 'rgba(255,212,145,0.55)');
  r.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCave(THREE, scene, beach, opts = {}) {
  const cx = opts.x ?? -48;
  const cz = opts.z ?? (beach.shoreZ(cx) + 2.2);
  const RH = opts.radius ?? 14.2, H = opts.height ?? 9.4, NP = 208, NE = 72, E0 = -0.35, E1 = Math.PI / 2;

  // Las 3 aperturas:
  // 1) ARC_MAIN: frente al mar / costa
  // 2) ARC_BACK: apertura lateral
  // 3) Claraboya superior en (ox, oz)
  const ARC_MAIN = -0.96;
  const ARC_BACK = -2.18;
  const ox = -1.8, oz = 1.6;

  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  scene.add(group);

  const radial = (e) => RH * Math.pow(Math.max(0, Math.cos(e)), 0.78);

  const surf = (p, e) => {
    const n1 = fbm(p * 1.9, e * 3.2);
    const baseRho = radial(e);
    const bx = Math.cos(p) * baseRho, bz = Math.sin(p) * baseRho;
    const distHole = Math.hypot((bx - ox) * 0.92, (bz - oz) * 1.15);
    const terrace = Math.sin(distHole * 2.35 + n1 * 2.2) * 0.14 * Math.exp(-Math.max(0, distHole - 2.6) * 0.24);
    const swirl = Math.sin(p * 8 + e * 5 + n1 * 5) * 0.022;
    const f = 1 + (n1 - 0.5) * 0.09 + swirl + 0.025 * Math.sin(p * 3 + 1);
    const rho = baseRho * f;
    const y = Math.sin(e) * H * (1 + (n1 - 0.5) * 0.05) + terrace;
    return new THREE.Vector3(Math.cos(p) * rho, y, Math.sin(p) * rho);
  };

  const isOpen = (p, e, wx, wz) => {
    const d1 = Math.abs(dAng(p, ARC_MAIN));
    if (d1 < 0.76 && e < 0.74 * Math.pow(Math.cos((d1 / 0.76) * Math.PI / 2), 0.56) + 0.03) return true;
    const d2 = Math.abs(dAng(p, ARC_BACK));
    if (d2 < 0.40 && e < 0.48 * Math.pow(Math.cos((d2 / 0.40) * Math.PI / 2), 0.60) + 0.025) return true;
    const q = Math.hypot((wx - ox) * 0.88, (wz - oz) * 1.12);
    return e > 0.72 && q < 3.45 + fbm(wx * 0.5, wz * 0.5) * 1.05;
  };

  const pos = [], uv = [], col = [], idx = [];
  const inner = [], grid = (i, j) => (i % NP) * (NE + 1) + j;

  for (let i = 0; i < NP; i++) {
    for (let j = 0; j <= NE; j++) {
      const p = (i / NP) * Math.PI * 2 - Math.PI;
      const e = E0 + ((E1 - E0) * j) / NE;
      const v = surf(p, e);
      inner.push({ v, p, e });
    }
  }

  const outerOf = (q) => {
    const n = new THREE.Vector3(q.v.x, Math.max(q.v.y, 0) * 1.5 + 0.001, q.v.z).normalize();
    const T = 0.75 + fbm(q.p * 2.3 + 7, q.e * 3) * 0.45;
    return q.v.clone().addScaledVector(n, T).add(new THREE.Vector3(0, q.v.y < 0 ? -1 : 0, 0));
  };

  const colorFor = (v, e, inside) => {
    const n = fbm(v.x * 0.35 + 9, v.z * 0.35 + v.y * 0.3);
    const m = fbm(v.x * 0.9, v.y * 0.9 + v.z * 0.9);
    const strataShade = Math.sin(v.y * 2.4 + n * 4) * 0.03;
    const c = new THREE.Color().setHSL(
      0.075 + (n - 0.5) * 0.03,
      0.56 + (m - 0.5) * 0.24,
      0.44 + (n - 0.5) * 0.26 + strataShade - (inside ? 0.02 : 0) + Math.max(0, v.y - 5) * 0.012
    );
    if (v.y < 2.2 && v.y > -0.6) {
      const k = Math.max(0, Math.min(1, (2.2 - v.y) / 2.8)) * (0.45 + m);
      c.lerp(new THREE.Color(0.34, 0.44, 0.16), Math.min(0.78, k * 0.85));
    }
    if (v.y < -0.2) c.lerp(new THREE.Color(0.08, 0.24, 0.25), 0.6);
    return c;
  };

  const off = inner.length;
  inner.forEach((q) => {
    const c = colorFor(q.v, q.e, true);
    pos.push(q.v.x, q.v.y, q.v.z);
    col.push(c.r, c.g, c.b);
    uv.push(q.p * 1.25, q.v.y * 0.32 + q.p * 0.25);
  });
  inner.forEach((q) => {
    const o = outerOf(q), c = colorFor(o, q.e, false);
    pos.push(o.x, o.y, o.z);
    col.push(c.r, c.g, c.b);
    uv.push(q.p * 1.35 + 3, o.y * 0.28);
  });

  const edges = new Map();
  const addEdge = (a, b) => {
    const k = a < b ? a + '_' + b : b + '_' + a;
    const r = edges.get(k);
    if (r) r.n++;
    else edges.set(k, { a, b, n: 1 });
  };

  for (let i = 0; i < NP; i++) {
    for (let j = 0; j < NE; j++) {
      const a = grid(i, j), b = grid(i + 1, j), c = grid(i + 1, j + 1), d = grid(i, j + 1);
      const pm = inner[a].p + (Math.PI * 2) / NP / 2;
      const em = inner[a].e + (E1 - E0) / NE / 2;
      const rho = radial(em);
      if (isOpen(pm, em, Math.cos(pm) * rho, Math.sin(pm) * rho)) continue;
      idx.push(a, b, c, a, c, d);
      idx.push(off + a, off + c, off + b, off + a, off + d, off + c);
      addEdge(a, b);
      addEdge(b, c);
      addEdge(c, d);
      addEdge(d, a);
    }
  }

  edges.forEach((ed) => {
    if (ed.n !== 1) return;
    const A = inner[ed.a], B = inner[ed.b];
    if (A.v.y < -0.9 && B.v.y < -0.9) return;
    if (A.e <= E0 + 0.001 && B.e <= E0 + 0.001) return;
    idx.push(ed.a, ed.b, off + ed.b, ed.a, off + ed.b, off + ed.a);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const tex = rockTexture(THREE);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: tex,
    bumpMap: tex,
    bumpScale: 1.4,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const shell = new THREE.Mesh(geo, mat);
  shell.castShadow = shell.receiveShadow = true;
  group.add(shell);

  // ---- Rocas grandes angulosas en la arena izquierda + colisiones ----
  const rockGeo = (s, seed) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const n = fbm(x * 1.8 + seed, z * 1.8 + y * 1.4);
      const facet = 1 + (n - 0.5) * 0.68 + Math.sin(y * 5 + seed) * 0.08;
      P.setXYZ(i, x * facet * s[0], y * facet * s[1], z * facet * s[2]);
    }
    g.computeVertexNormals();
    return g;
  };

  const rocks = [
    [-7.2, 3.8, 2.5, 1.65, 2.1, 1],
    [-4.3, 5.9, 1.15, 0.85, 1.05, 2],
    [-8.9, 6.8, 0.75, 0.52, 0.72, 3]
  ];
  const solid = [];
  for (const [rx, rz, sx, sy, sz, seed] of rocks) {
    const wx = cx + rx, wz = cz + rz;
    const y = Math.max(0, beach.heightAt(wx, wz));
    const m = new THREE.Mesh(rockGeo([sx, sy, sz], seed * 7), mat);
    m.position.set(rx, y + sy * 0.35, rz);
    m.rotation.y = seed * 0.9;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    solid.push(m);
  }

  group.updateMatrixWorld(true);
  if (beach.rockMeshes && solid.length) {
    solid.forEach((m) => beach.rockMeshes.push(m));
  }

  const isInside = (wx, wz) => Math.hypot(wx - cx, wz - cz) <= RH + 2.2;
  beach.isInsideCave = isInside;

  const sunDir = beach.sunDir, up = new THREE.Vector3(0, 1, 0);
  const holeE = Math.acos(Math.min(1, Math.pow(Math.hypot(ox, oz) / RH, 1 / 0.78)));
  const holeY = Math.sin(holeE) * H;
  const hole = new THREE.Vector3(ox, holeY, oz);

  const shaftMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uA: { value: 0 }, uT: { value: 0 } },
    vertexShader:
      'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;}',
    fragmentShader:
      'uniform float uA,uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){float f=pow(abs(dot(normalize(vN),normalize(vV))),1.6); float fade=smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.55,1.,vUv.y)); float dust=.85+.15*sin(vUv.y*40.-uT*.6+vUv.x*12.); gl_FragColor=vec4(vec3(1.,.82,.5)*f*fade*dust*uA,1.);}'
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.6, 17, 28, 1, true), shaftMat);
  shaft.renderOrder = 5;
  group.add(shaft);

  const spot = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: glowTexture(THREE),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0
    })
  );
  spot.rotation.x = -Math.PI / 2;
  spot.renderOrder = 4;
  group.add(spot);

  const warm = new THREE.PointLight(0xffa860, 0, 26, 2);
  warm.position.set(ox - 0.8, 1.8, oz + 0.8);
  group.add(warm);

  const teal = new THREE.PointLight(0x35e0d2, 0, 20, 2);
  teal.position.set(1.2, 0.6, -7.5);
  group.add(teal);

  let t = 0;
  function update(dt, time) {
    const safeDt = Number.isFinite(dt) ? Math.min(dt, 0.1) : 0.016;
    t = Number.isFinite(time) ? time : t + safeDt;
    const sy = Number.isFinite(sunDir?.y) ? sunDir.y : 0.5;
    const day = Math.max(0, Math.min(1, sy * 2.2));
    const dir = (sunDir ? sunDir.clone() : new THREE.Vector3(-0.75, 0.5, -0.35)).normalize().negate();
    shaft.quaternion.setFromUnitVectors(up, dir);
    shaft.position.copy(hole).addScaledVector(dir, 8.5);
    shaftMat.uniforms.uA.value = 0.52 * day;
    shaftMat.uniforms.uT.value = t;
    const fy = 0.45;
    const tt = day > 0.05 ? (holeY - fy) / Math.max(0.15, sy) : 0;
    spot.position.set(hole.x + dir.x * tt, fy + 0.03, hole.z + dir.z * tt);
    spot.scale.set(6.5, 6.5 / Math.max(0.25, sy), 1);
    spot.rotation.z = Math.atan2(dir.x, dir.z);
    spot.material.opacity = 0.58 * day;
    warm.intensity = 24 * day;
    teal.intensity = (18 + Math.sin(t * 1.7) * 3 + Math.sin(t * 2.9) * 2) * day;
    teal.position.x = 1.2 + Math.sin(t * 0.6) * 1.5;
  }

  update(0, 0);
  return { group, update, isInside, center: { x: cx, z: cz }, radius: RH };
}