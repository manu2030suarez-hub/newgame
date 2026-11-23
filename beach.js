// beach.js — Playa realista procedural (sin texturas externas)
// Namespace: BeachWorld  ·  Uso:  const beach = BeachWorld.create(scene, renderer, { sun, hemi });
import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';

const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
function rockRandSafe(i,s){let x=(i+1)*374761393+(s+7)*668265263;x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967295;}
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function hash2(ix, iz) { let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x, z) { let s = 0, a = .5; for (let i = 0; i < 4; i++) { s += a * vnoise(x, z); x = x * 2.03 + 11.7; z = z * 2.03 + 5.3; a *= .5; } return s; }

function shoreZ(x) { return -35 + 5 * Math.sin(x * .022 + 1.3) + 2.2 * Math.sin(x * .07 + .4) + 1.1 * Math.sin(x * .19); }

const CAVE_DEFAULT_X = -48;
const CAVE_RH = 14.2;
const CAVE_OX = -1.8, CAVE_OZ = 1.6;
const CAVE_ARC_MAIN = -0.96, CAVE_ARC_MAIN_HALF = 0.76;
const CAVE_ARC_BACK = -2.18, CAVE_ARC_BACK_HALF = 0.40;

function dAngWrap(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function caveOpeningFactorAt(x, z, cx = CAVE_DEFAULT_X, cz = null) {
  const centerZ = cz ?? (shoreZ(cx) + 2.2);
  const lx = x - cx;
  const lz = z - centerZ;

  const q = Math.hypot((lx - CAVE_OX) * 0.88, (lz - CAVE_OZ) * 1.12);
  const holeRadius = 3.55 + fbm2(lx * 0.5, lz * 0.5) * 0.95;
  const holeOpen = 1 - ss(holeRadius - 0.65, holeRadius + 0.55, q);

  const ang = Math.atan2(lz, lx);
  const radMid = Math.hypot(lx, lz);
  const radialFade = 1 - ss(CAVE_RH * 1.45, CAVE_RH * 1.95, radMid);

  const dMain = Math.abs(dAngWrap(ang, CAVE_ARC_MAIN));
  const mainOpen = (1 - ss(CAVE_ARC_MAIN_HALF - 0.08, CAVE_ARC_MAIN_HALF + 0.14, dMain)) * radialFade;

  const dBack = Math.abs(dAngWrap(ang, CAVE_ARC_BACK));
  const backOpen = (1 - ss(CAVE_ARC_BACK_HALF - 0.07, CAVE_ARC_BACK_HALF + 0.12, dBack)) * radialFade;

  return Math.max(holeOpen, mainOpen, backOpen);
}

export function isCaveSandCoverOpenAt(x, z, cx = CAVE_DEFAULT_X, cz = null) {
  return caveOpeningFactorAt(x, z, cx, cz) > 0.35;
}

function caveHillDeltaH(x, z) {
  const cx = CAVE_DEFAULT_X;
  const cz = shoreZ(cx) + 2.2;
  const dx = x - cx;
  const dz = z - cz;
  const r = Math.hypot(dx, dz);

  const outerMask = ss(CAVE_RH * 0.82, CAVE_RH * 1.12, r);
  const maxR = 32.5;
  if (r >= maxR || outerMask <= 0) return 0;

  const openFactor = caveOpeningFactorAt(x, z, cx, cz);
  const keepMount = 1 - openFactor;
  if (keepMount <= 0) return 0;

  const t = 1 - r / maxR;
  const smoothProfile = t * t * (3 - 2 * t);
  const crest = 15.8 * Math.pow(smoothProfile, 1.08);
  const undulation = (fbm2(x * 0.048 + 7.2, z * 0.048 - 3.4) - 0.48) * 1.35 * smoothProfile;
  return Math.max(0, crest + undulation) * outerMask * keepMount;
}

export function caveSandCoverHeightAt(x, z, cx = CAVE_DEFAULT_X, cz = null) {
  if (cx === CAVE_DEFAULT_X && (cz === null || Math.abs(cz - (shoreZ(cx) + 2.2)) < 0.001)) {
    return terrainH(x, z);
  }
  const centerZ = cz ?? (shoreZ(cx) + 2.2);
  const r = Math.hypot(x - cx, z - centerZ);
  const outerMask = ss(CAVE_RH * 0.82, CAVE_RH * 1.12, r);
  const maxR = 32.5;
  if (r >= maxR || outerMask <= 0) return terrainH(x, z);
  const keepMount = 1 - caveOpeningFactorAt(x, z, cx, centerZ);
  if (keepMount <= 0) return terrainH(x, z);
  const t = 1 - r / maxR;
  const smoothProfile = t * t * (3 - 2 * t);
  const crest = 15.8 * Math.pow(smoothProfile, 1.08);
  const undulation = (fbm2(x * 0.048 + 7.2, z * 0.048 - 3.4) - 0.48) * 1.35 * smoothProfile;
  return terrainH(x, z) + Math.max(0, crest + undulation) * outerMask * keepMount;
}

function terrainH(x, z) {
  const d = z - shoreZ(x);
  let h;
  if (d < 0) h = -6 * (1 - Math.exp(d * .012));
  else {
    h = 1.2 * (1 - Math.exp(-d * .035));
    const k = ss(25, 70, d);
    if (k > 0) h += k * Math.max(0, fbm2(x * .012, z * .012) - .25) * 5.5;
  }
  h += caveHillDeltaH(x, z);

  const mx = 76, mz = 82, dx = (x - mx) / 58, dz = (z - mz) / 66;
  const radial = Math.sqrt(dx * dx + dz * dz);
  const mountainMask = 1 - ss(.62, 1.12, radial);
  const ridge = .82 + .18 * fbm2(x * .035 + 19, z * .035 - 7) + .075 * Math.sin(x * .105 + z * .043);
  const peak = Math.pow(Math.max(0, 1 - radial), 1.28);
  h += mountainMask * (3.5 + 31 * peak) * ridge;
  const spurA = Math.max(0, 1 - Math.hypot((x - 42) / 23, (z - 94) / 31));
  const spurB = Math.max(0, 1 - Math.hypot((x - 104) / 26, (z - 55) / 28));
  h += spurA * (7 + 5 * fbm2(x * .06, z * .06)) + spurB * (6 + 4 * fbm2(x * .055 + 8, z * .055));
  return h;
}

const GLSL_NOISE = `
float bwHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float bwNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(bwHash(i),bwHash(i+vec2(1.,0.)),f.x),mix(bwHash(i+vec2(0.,1.)),bwHash(i+vec2(1.,1.)),f.x),f.y);}
float bwFbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*bwNoise(p);p=p*2.03+17.1;a*=.5;}return s;}
`;
const GLSL_SHORE = `
float bwShoreZ(float x){return -35.+5.*sin(x*.022+1.3)+2.2*sin(x*.07+.4)+1.1*sin(x*.19);}
float bwTerrH(vec2 p){float d=p.y-bwShoreZ(p.x);return d<0.? -6.*(1.-exp(d*.012)) : 1.2*(1.-exp(-d*.035));}
`;
const GLSL_SKY = `
vec3 bwSky(vec3 d){
  float y=max(d.y,0.);
  vec3 col=mix(uHorizon,uZenith,pow(y,.42));
  float s=max(dot(d,uSunDir),0.);
  col+=uSunCol*(pow(s,6.)*.10+pow(s,60.)*.22+pow(s,2500.)*2.5+pow(s,30000.)*30.);
  if(d.y>.015){
    vec2 uv=d.xz/(d.y+.14)*1.3+vec2(uTime*.012,uTime*.004);
    float c=smoothstep(.52,.78,bwFbm(uv))*smoothstep(.015,.22,d.y);
    float lit=clamp(.5+(bwFbm(uv*1.7+3.)-.4)*1.5,0.,1.);
    vec3 cc=mix(vec3(.60,.65,.73),vec3(1.05),lit);
    col=mix(col,cc,c*.88);
  }
  return col;
}
`;

const SKY_VERT = `varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SKY_FRAG = `
uniform float uTime;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform vec3 uZenith;uniform vec3 uHorizon;uniform vec3 fogColor;
varying vec3 vDir;
${GLSL_NOISE}
${GLSL_SKY}
void main(){
  vec3 d=normalize(vDir);
  vec3 c=d.y>=0.?bwSky(d):uHorizon*.9;
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  float hz=1.-smoothstep(-.02,.20,d.y);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(hz,0.,1.));
}`;

const WATER_VERT = `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vec4 wp=modelMatrix*vec4(position,1.);
  vWorld=wp.xyz;
  vec4 mvPosition=viewMatrix*wp;
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAG = `
uniform float uTime;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform vec3 uZenith;uniform vec3 uHorizon;
varying vec3 vWorld;
#include <fog_pars_fragment>
${GLSL_NOISE}
${GLSL_SKY}
${GLSL_SHORE}
void bwWave(inout vec2 g,vec2 p,vec2 dir,float lam,float amp){
  vec2 dn=normalize(dir);
  float k=6.28318/lam;
  float ph=k*dot(dn,p)-sqrt(9.81*k)*uTime;
  g+=dn*k*amp*cos(ph);
}
void main(){
  vec2 p=vWorld.xz;
  float depth=-bwTerrH(p);
  if(depth<.004) discard;
  vec3 toCam=cameraPosition-vWorld;
  float dist=length(toCam);
  vec3 V=toCam/dist;
  float hf=1.-.7*smoothstep(50.,400.,dist);

  vec2 g=vec2(0.);
  bwWave(g,p,vec2(.15,1.),58.,.52);
  bwWave(g,p,vec2(-.45,1.),28.,.22);
  bwWave(g,p,vec2(.55,1.),9.5,.06);
  bwWave(g,p,vec2(-.2,1.),4.8,.028*hf);
  bwWave(g,p,vec2(.8,.6),2.3,.013*hf);
  bwWave(g,p,vec2(-.7,.7),1.1,.006*hf);
  g+=(vec2(bwNoise(p*.8+uTime*.3),bwNoise(p*.8+17.-uTime*.25))-.5)*.10*hf;
  float bigSet=pow(max(0.,sin(uTime*.19+p.x*.018)),10.);
  g*=mix(.35,1.,smoothstep(0.,4.,depth))*(1.+bigSet*1.35);
  vec3 N=normalize(vec3(-g.x,1.,-g.y));

  float cosT=clamp(dot(N,V),0.,1.);
  float fr=.02+.98*pow(1.-cosT,5.);
  vec3 R=reflect(-V,N);R.y=abs(R.y);
  vec3 refl=bwSky(R);

  vec3 shallow=vec3(.02,.33,.35);
  vec3 deep=vec3(.002,.04,.09);
  vec3 body=mix(shallow,deep,pow(smoothstep(0.,7.,depth),.7))*(.55+.9*uSunDir.y);
  vec3 col=mix(body,refl,fr);
  vec3 Hh=normalize(V+uSunDir);
  col+=uSunCol*pow(max(dot(N,Hh),0.),700.)*2.5;

  float d0=p.y-bwShoreZ(p.x);
  float q=max(-d0,0.);
  float n=bwFbm(p*.9+vec2(uTime*.10,0.));
  float edge=(1.-smoothstep(0.,.6,depth))*(.55+.45*n);
  float s=q*.19-uTime*.9;
  float surf=pow(max(0.,sin(s*6.28318)),5.)*(1.-smoothstep(4.,38.,q))*smoothstep(0.,6.,q);
  surf*=smoothstep(.35,.75,bwFbm(p*.35+vec2(uTime*.05,0.)));
  surf*=1.+bigSet*1.7;
  float foam=clamp(edge+surf*.98,0.,1.);
  col=mix(col,vec3(.92,.95,.97),foam*.9);

  float a=clamp(.30+depth*.50,0.,.97)*smoothstep(.004,.10,depth);
  a=max(a,foam*.92*smoothstep(.004,.05,depth));
  gl_FragColor=vec4(col,a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function makeCanvasTexture(w, h, draw, { srgb = true, repeat = true, aniso = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
function sandAlbedo(g, w, h) {
  const img = g.createImageData(w, h), rnd = mulberry32(7), T = Math.PI * 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 1 + (rnd() - .5) * .10 + .035 * Math.sin(T * 5 * x / w) * Math.sin(T * 4 * y / h) + .03 * Math.sin(T * (11 * x / w + 7 * y / h));
    const r = rnd(); if (r < .004) v *= .62; else if (r > .998) v *= 1.12;
    const i = (y * w + x) * 4;
    img.data[i] = clamp(226 * v, 0, 255); img.data[i + 1] = clamp(207 * v, 0, 255); img.data[i + 2] = clamp(165 * v, 0, 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
// Textura de suelo selvático: tierra orgánica, manchas y briznas finas en varias tonalidades.
function jungleGrassAlbedo(g, w, h) {
  const img = g.createImageData(w, h), rnd = mulberry32(91827);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = rnd(), broad = Math.sin(x * .047 + Math.sin(y * .031) * 2.1) * .5 + Math.sin(y * .039 + x * .018) * .5;
    const patch = Math.sin(x * .013 + y * .021) * .5 + .5, v = .78 + n * .25 + broad * .075 + patch * .12;
    const i = (y * w + x) * 4;
    img.data[i] = clamp((48 + patch * 15) * v, 0, 255);
    img.data[i + 1] = clamp((88 + patch * 29) * v, 0, 255);
    img.data[i + 2] = clamp((31 + patch * 12) * v, 0, 255);
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 18000; i++) {
    const x = rnd() * w, y = rnd() * h, len = 2 + rnd() * 13, hue = rnd(), light = rnd();
    g.strokeStyle = hue < .22 ? `rgba(25,48,17,${.18 + light * .22})` : hue > .82 ? `rgba(133,151,55,${.16 + light * .24})` : `rgba(65,105,31,${.20 + light * .30})`;
    g.lineWidth = .45 + rnd() * 1.25;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + (rnd() - .5) * 5, y - len * .55, x + (rnd() - .5) * 9, y - len);
    g.stroke();
  }
  for (let i = 0; i < 950; i++) {
    const x = rnd() * w, y = rnd() * h, r = .5 + rnd() * 2.4;
    g.fillStyle = rnd() < .5 ? 'rgba(38,31,18,.20)' : 'rgba(164,139,75,.16)';
    g.beginPath(); g.ellipse(x, y, r * 1.7, r, rnd() * Math.PI, 0, Math.PI * 2); g.fill();
  }
}

function sandNormal(g, w, h) {
  const H = new Float32Array(w * h), rnd = mulberry32(11), T = Math.PI * 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const warp = .12 * Math.sin(T * 3 * x / w) + .07 * Math.sin(T * 5 * x / w + 1);
    H[y * w + x] = Math.sin(T * (14 * y / h + warp)) * .5 + (rnd() - .5) * .35;
  }
  const img = g.createImageData(w, h), S = 2.2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = H[y * w + (x + w - 1) % w], xr = H[y * w + (x + 1) % w], yu = H[((y + h - 1) % h) * w + x], yd = H[((y + 1) % h) * w + x];
    let nx = (xl - xr) * S, ny = (yu - yd) * S, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    img.data[i] = (nx * .5 + .5) * 255; img.data[i + 1] = (ny * .5 + .5) * 255; img.data[i + 2] = (nz * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function barkTex(g, w, h) {
  const rnd = mulberry32(21);
  g.fillStyle = '#7a634c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w, lw = 1 + rnd() * 2.2;
    g.fillStyle = rnd() < .5 ? `rgba(40,30,22,${.06 + rnd() * .12})` : `rgba(190,170,140,${.05 + rnd() * .10})`;
    g.fillRect(x, 0, lw, h);
  }
  for (let y = 4; y < h; y += 15 + rnd() * 7) {
    g.strokeStyle = 'rgba(38,28,20,.78)'; g.lineWidth = 3 + rnd() * 2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * .09 + y) * 1.6);
    g.stroke();
    g.strokeStyle = 'rgba(175,155,125,.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y + 4);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y + 4 + Math.sin(x * .09 + y) * 1.6);
    g.stroke();
  }
}
function frondTex(g, w, h) {
  const rnd = mulberry32(33), cx = w / 2;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#6a8a30'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(cx, h); g.lineTo(cx, 4); g.stroke();
  const cols = ['#3b6a20', '#487a26', '#33601e', '#5a8a2f', '#406f22'];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1); if (t < .07) continue;
    const y = h - 14 - t * (h - 26);
    const lp = Math.pow(Math.sin(Math.PI * clamp((t + .04) / 1.04, 0, 1)), .6);
    for (const sd of [-1, 1]) {
      const len = (w * .48) * lp * (.9 + rnd() * .18);
      const ex = cx + sd * len, ey = y - len * (.50 + rnd() * .2);
      g.fillStyle = cols[(rnd() * cols.length) | 0];
      g.beginPath(); g.moveTo(cx, y + 3); g.lineTo(ex, ey); g.lineTo(cx, y - 3); g.closePath(); g.fill();
    }
  }
}
function grassTex(g, w, h) {
  const rnd = mulberry32(44);
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 20; i++) {
    const bx = 14 + rnd() * (w - 28), top = 10 + rnd() * h * .55, lean = (rnd() - .5) * 46;
    const gr = g.createLinearGradient(0, h, 0, top);
    gr.addColorStop(0, '#3a5a22'); gr.addColorStop(.6, '#7d9a3a'); gr.addColorStop(1, '#c2c273');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(bx - 3.5, h); g.quadraticCurveTo(bx + lean * .3, h * .55, bx + lean, top); g.quadraticCurveTo(bx + lean * .3 + 2, h * .55, bx + 3.5, h); g.closePath(); g.fill();
  }
}

function buildPalm(seed) {
  const rnd = mulberry32(seed);
  const H = 7.2 + rnd() * 3.3, lean = .9 + rnd() * 2.1, side = (rnd() - .5) * 1.2;
  const P0 = new THREE.Vector3(0, 0, 0), P1 = new THREE.Vector3(lean * .12, H * .55, side * .3), P2 = new THREE.Vector3(lean, H, side);
  const bez = (t, o) => { const u = 1 - t; return o.set(u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y, u * u * P0.z + 2 * u * t * P1.z + t * t * P2.z); };
  const tang = (t, o) => o.set(2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x), 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y), 2 * (1 - t) * (P1.z - P0.z) + 2 * t * (P2.z - P1.z)).normalize();

  const RAD = 10, ROWS = 20, tp = [], tuv = [], ti = [];
  const c = new THREE.Vector3(), T = new THREE.Vector3(), prev = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3(), ref = new THREE.Vector3();
  let acc = 0;
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS; bez(t, c); tang(t, T);
    ref.set(Math.abs(T.z) > .9 ? 1 : 0, 0, Math.abs(T.z) > .9 ? 0 : 1);
    n1.crossVectors(ref, T).normalize(); n2.crossVectors(T, n1).normalize();
    const rad = lerp(.30, .165, t) * (1 + .9 * Math.exp(-t * 14)) * (1 + .04 * Math.sin(t * 40));
    if (r > 0) acc += c.distanceTo(prev); prev.copy(c);
    for (let j = 0; j <= RAD; j++) {
      const a = j / RAD * Math.PI * 2, ca = Math.cos(a) * rad, sa = Math.sin(a) * rad;
      tp.push(c.x + n1.x * ca + n2.x * sa, c.y + n1.y * ca + n2.y * sa, c.z + n1.z * ca + n2.z * sa);
      tuv.push(j / RAD, acc / 3.0);
    }
  }
  for (let r = 0; r < ROWS; r++) for (let j = 0; j < RAD; j++) {
    const a = r * (RAD + 1) + j, b = a + RAD + 1;
    ti.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const trunkGeo = new THREE.BufferGeometry();
  trunkGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  trunkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
  trunkGeo.setIndex(ti); trunkGeo.computeVertexNormals();

  const fp = [], fuv = [], fi = [], S = 12, nF = 14 + Math.floor(rnd() * 3);
  const up = new THREE.Vector3(0, 1, 0), origin = P2.clone().add(new THREE.Vector3(0, .05, 0));
  for (let f = 0; f < nF; f++) {
    const ph = f / nF * Math.PI * 2 + rnd() * .35, dx = Math.cos(ph), dz = Math.sin(ph);
    const L = 3.1 + rnd() * 1.0, rise = f % 3 === 0 ? .15 + rnd() * .25 : .45 + rnd() * .5, droop = .55 + rnd() * .7, W = 1.55 + rnd() * .3;
    const pts = [];
    for (let s = 0; s <= S; s++) { const t = s / S; pts.push(new THREE.Vector3(origin.x + dx * L * t, origin.y + L * (rise * t - droop * t * t), origin.z + dz * L * t)); }
    const base = fp.length / 3;
    for (let s = 0; s <= S; s++) {
      const t = s / S, a = pts[Math.max(s - 1, 0)], b = pts[Math.min(s + 1, S)];
      const tg = new THREE.Vector3().subVectors(b, a).normalize();
      const sv = new THREE.Vector3().crossVectors(tg, up).normalize();
      const p = pts[s], drop = W * .30;
      fp.push(p.x - sv.x * W / 2, p.y - sv.y * W / 2 - drop, p.z - sv.z * W / 2, p.x, p.y, p.z, p.x + sv.x * W / 2, p.y + sv.y * W / 2 - drop, p.z + sv.z * W / 2);
      fuv.push(0, t, .5, t, 1, t);
    }
    for (let s = 0; s < S; s++) {
      const b = base + s * 3;
      fi.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
    }
  }
  const frondGeo = new THREE.BufferGeometry();
  frondGeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  frondGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  frondGeo.setIndex(fi); frondGeo.computeVertexNormals();
  return { trunkGeo, frondGeo, top: P2.clone() };
}

// Naufragio principal: modelo GLB liviano con texturas integradas.
function createShipwreck(scene, opts = {}) {
  const group = new THREE.Group();
  group.name = 'shipwreck';
  scene.add(group);

  // El escenario puede cargar el naufragio por sí mismo si no recibe un loader externo.
  const loader = opts.gltfLoader || new GLTFLoader();
  const modelUrl = new URL('./shipwreck.glb', import.meta.url).href;

  const x = opts.x ?? 12;
  const z = opts.z ?? (shoreZ(x) + 1.5);
  const targetLength = 12.0;

  loader.load(modelUrl, (gltf) => {
    const model = gltf.scene;
    model.name = 'shipwreck-model';
    // El casco debe verse prácticamente derecho; solo conserva una leve inclinación natural.
    model.rotation.set(opts.pitch ?? 0, opts.yaw ?? 0.35, opts.tiltRoll ?? 0.025);
    model.updateMatrixWorld(true);

    let bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const horizontal = Math.max(size.x, size.z);
    if (!Number.isFinite(horizontal) || horizontal < 0.001) {
      console.warn('Naufragio: el modelo no tiene dimensiones válidas.');
      return;
    }

    model.scale.setScalar(targetLength / horizontal);
    bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    const finalSize = bounds.getSize(new THREE.Vector3());

    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      // Algunos naufragios descargados incluyen una base enorme de arena.
      // Quitamos solo superficies casi planas y muy anchas para evitar que se superpongan con la playa del juego.
      const meshBounds = new THREE.Box3().setFromObject(obj);
      const meshSize = meshBounds.getSize(new THREE.Vector3());
      if (meshSize.x > 8 && meshSize.z > 8 && meshSize.y < 0.35) {
        obj.visible = false;
        console.info('Naufragio: se ocultó la base plana de arena del modelo.');
      }
    });

    group.position.set(x, terrainH(x, z) - (opts.sink ?? 0.18) - bounds.min.y, z);
    group.add(model);
    group.updateMatrixWorld(true);

    // Volumen de colisión sencillo para impedir atravesar el casco.
    if (Array.isArray(opts.colliders)) {
      opts.colliders.push({
        x, z,
        r: Math.max(1.8, Math.min(finalSize.x, finalSize.z) * 0.42),
        rx: Math.max(2.2, finalSize.x * 0.43),
        rz: Math.max(2.2, finalSize.z * 0.43),
        rock: true,
        bottom: group.position.y + bounds.min.y,
        top: group.position.y + bounds.max.y,
        mesh: model
      });
    }
    console.info('Naufragio cargado:', 'shipwreck.glb');
  }, undefined, (error) => {
    console.error('No se pudo cargar shipwreck.glb desde', modelUrl, error);
  });

  return group;
}

function create(scene, renderer, opts = {}) {
  const sun = opts.sun || null, hemi = opts.hemi || null;
  const aniso = renderer.capabilities?.getMaxAnisotropy?.() || 4;
  const uTime = { value: 0 };
  const sunDir = (opts.sunDir ? opts.sunDir.clone() : new THREE.Vector3(-.75, .5, -.35)).normalize();

  const fogColor = new THREE.Color().setRGB(.70, .82, .92, THREE.LinearSRGBColorSpace);
  scene.fog = new THREE.FogExp2(fogColor, .0042);
  scene.background = scene.fog.color;
  renderer.toneMappingExposure = .8;
  if (sun) { sun.color.set(0xfff1da); sun.intensity = 3.0; }
  if (hemi) { hemi.color.set(0xbfdcff); hemi.groundColor.set(0xd8c49a); hemi.intensity = .3; }

  const skyUniforms = {
    uTime, uSunDir: { value: sunDir }, uSunCol: { value: new THREE.Vector3(1, .88, .70) },
    uZenith: { value: new THREE.Vector3(.06, .24, .62) }, uHorizon: { value: new THREE.Vector3(.52, .74, .90) },
    fogColor: { value: scene.fog.color }
  };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false });
  const domeGeo = new THREE.SphereGeometry(1, 32, 16);
  const dome = new THREE.Mesh(domeGeo, skyMat);
  dome.renderOrder = -1000; dome.frustumCulled = false;
  scene.add(dome);

  if (!opts.noEnv) {
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const envDome = new THREE.Mesh(domeGeo, skyMat); envDome.frustumCulled = false; envScene.add(envDome);
      scene.environment = pm.fromScene(envScene, 0, .1, 10).texture;
      pm.dispose();
    } catch (e) { console.warn('Beach: no se pudo generar el entorno', e); }
  }

  const SIZE = 700, SEG = 640;
  const tgeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tgeo.rotateX(-Math.PI / 2);
  const pos = tgeo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z), d = z - shoreZ(x);
    pos.setY(i, h);
    const t = .92 + .16 * fbm2(x * .03 + 50, z * .03);
    let r = t, g = t, b = t * .97;
    const mountainZone = 1 - ss(112, 142, Math.hypot(x - 76, z - 82));
    const veg = ss(55, 110, d) * ss(.35, .6, fbm2(x * .02 - 30, z * .02 + 8)) * (1 - mountainZone);
    r *= 1 - .28 * veg; g *= 1 - .10 * veg; b *= 1 - .45 * veg;
    const mountain = ss(3.8, 9.5, h) * mountainZone;
    const stoneNoise = .70 + .34 * fbm2(x * .16 + 31, z * .16 - 13) + .08 * Math.sin(x * .31 + z * .17);
    const rockR = .39 * stoneNoise, rockG = .40 * stoneNoise, rockB = .405 * stoneNoise;
    r = THREE.MathUtils.lerp(r, rockR, mountain);
    g = THREE.MathUtils.lerp(g, rockG, mountain);
    b = THREE.MathUtils.lerp(b, rockB, mountain);
    if (h < 0) { const k = .78 + .22 * Math.exp(h * .5); r *= k; g *= k; b *= k * 1.02; }
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  tgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tgeo.computeVertexNormals();
  const sandMap = makeCanvasTexture(512, 512, sandAlbedo, { aniso }); sandMap.repeat.set(140, 140);
  const sandNrm = makeCanvasTexture(256, 256, sandNormal, { srgb: false, aniso }); sandNrm.repeat.set(350, 350);
  const jungleGrassMap = makeCanvasTexture(512, 512, jungleGrassAlbedo, { aniso });
  const sandMat = new THREE.MeshStandardMaterial({ map: sandMap, normalMap: sandNrm, normalScale: new THREE.Vector2(.7, .7), roughness: .95, metalness: 0, vertexColors: true });
  sandMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uJungleGrassMap = { value: jungleGrassMap };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vH;varying vec2 vXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH=position.y;vXZ=position.xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vH;varying vec2 vXZ;uniform float uTime;uniform sampler2D uJungleGrassMap;\n${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Césped de selva: máscara orgánica y transición suave hacia la arena.
        vec2 jungleP=vec2((vXZ.x-94.)/82.,(vXZ.y-137.)/25.);
        float jungleDist=length(jungleP);
        float jungleNoise=bwFbm(vXZ*.075+vec2(18.4,-7.2));
        float jungleMask=1.-smoothstep(.88,1.16,jungleDist+(jungleNoise-.5)*.13);
        vec3 jungleGrass=texture2D(uJungleGrassMap,vXZ*.19).rgb;
        jungleGrass*=.88+.16*bwFbm(vXZ*.31+vec2(4.1,29.));
        diffuseColor.rgb=mix(diffuseColor.rgb,jungleGrass,jungleMask);
        float bwWsh=.06+.055*sin(uTime*.55+vXZ.x*.035)+.035*sin(uTime*.31+vXZ.x*.11+1.7);
        float bwN=bwFbm(vXZ*.8);
        float bwEdge=bwWsh+(bwN-.5)*.05;
        float bwFilm=1.-smoothstep(bwEdge-.025,bwEdge,vH);
        float bwWet=1.-smoothstep(bwEdge,bwEdge+.28,vH);
        float bwFoam=smoothstep(bwEdge-.10,bwEdge-.02,vH)*(1.-smoothstep(bwEdge-.02,bwEdge,vH));
        diffuseColor.rgb*=mix(1.,.62,max(bwWet*.8,bwFilm)*(1.-jungleMask));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93),bwFoam*.55*(.5+bwN)*(1.-jungleMask));`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.18,max(bwWet*.6,bwFilm));roughnessFactor=mix(roughnessFactor,.96,jungleMask);');
  };
  const terrain = new THREE.Mesh(tgeo, sandMat);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);

  const waterGeo = new THREE.PlaneGeometry(6000, 6000); waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uSunDir: { value: sunDir }, uSunCol: { value: new THREE.Vector3(1, .88, .70) },
      uZenith: { value: new THREE.Vector3(.06, .24, .62) }, uHorizon: { value: new THREE.Vector3(.52, .74, .90) }
    }]),
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, fog: true
  });
  waterMat.uniforms.uTime = uTime;
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.frustumCulled = false; water.renderOrder = 2;
  scene.add(water);

  const trunkTex = makeCanvasTexture(128, 512, barkTex, { aniso });
  const frondTexture = makeCanvasTexture(256, 512, frondTex, { aniso, repeat: false });
  const swayCommon = '\nuniform float uTime;';
  const trunkMat = new THREE.MeshStandardMaterial({ map: trunkTex, bumpMap: trunkTex, bumpScale: 1.5, roughness: .92, side: THREE.DoubleSide });
  trunkMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + swayCommon)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float swT=pow(max(position.y,0.)/9.,2.);
        float swP=uTime*.9+instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;
        transformed.x+=sin(swP)*.05*swT;transformed.z+=cos(swP*.8)*.03*swT;`);
  };
  const frondMat = new THREE.MeshStandardMaterial({ map: frondTexture, alphaTest: .35, roughness: .62, side: THREE.DoubleSide, emissive: 0x0a1f08, emissiveIntensity: .5 });
  frondMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + swayCommon)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float swT=pow(max(position.y,0.)/9.,2.);
        float swP=uTime*.9+instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;
        transformed.x+=sin(swP)*.05*swT;transformed.z+=cos(swP*.8)*.03*swT;
        float tipw=uv.y*uv.y;
        transformed+=vec3(sin(swP*2.3+position.x*3.)*.10,sin(swP*1.9+position.z*2.)*.12,cos(swP*2.1+position.y)*.09)*tipw;`);
  };
  const colliders = [];
  const rockMeshes = [];
  const wreckWalkableMeshes = [];
  const shipwreckGroup = createShipwreck(scene, {
    x: 12,
    z: shoreZ(12) + 1.5,
    yaw: 0.35,
    tiltRoll: 0.025,
    pitch: 0,
    sink: 0.18,
    scale: 1.0,
    walkableMeshes: wreckWalkableMeshes,
    colliders,
    gltfLoader: opts.gltfLoader || null,
  });

  const rockRaycaster = new THREE.Raycaster();
  const rockRayOrigin = new THREE.Vector3();
  const rockRayDown = new THREE.Vector3(0,-1,0);
  const rockSideRaycaster = new THREE.Raycaster();
  const rockMoveOrigin = new THREE.Vector3(), rockMoveDir = new THREE.Vector3();
  const harvestPalms = [];

  const rockGeo = new THREE.DodecahedronGeometry(1, 2);
  const rockPos = rockGeo.attributes.position;
  for (let i = 0; i < rockPos.count; i++) {
    const x = rockPos.getX(i), y = rockPos.getY(i), z = rockPos.getZ(i);
    const n = .88 + .10 * Math.sin(x * 8.7 + y * 4.1) * Math.cos(z * 7.3 - y * 5.2)
      + .045 * Math.sin((x + z) * 19.);
    rockPos.setXYZ(i, x * n, y * n, z * n);
  }
  rockGeo.computeVertexNormals();
  const rockCanvas=document.createElement('canvas');rockCanvas.width=rockCanvas.height=512;const rctx=rockCanvas.getContext('2d');
  rctx.fillStyle='#77766e';rctx.fillRect(0,0,512,512);
  for(let i=0;i<26000;i++){const x=rockRandSafe(i,17)*512,y=rockRandSafe(i,31)*512,a=.025+rockRandSafe(i,47)*.17;rctx.fillStyle=rockRandSafe(i,61)>.52?`rgba(224,218,197,${a})`:`rgba(25,35,34,${a})`;rctx.beginPath();rctx.arc(x,y,.3+rockRandSafe(i,73)*2.4,0,Math.PI*2);rctx.fill();}
  for(let i=0;i<95;i++){const x=rockRandSafe(i,83)*512,y=rockRandSafe(i,97)*512;rctx.strokeStyle=`rgba(42,49,45,${.06+rockRandSafe(i,101)*.12})`;rctx.lineWidth=1+rockRandSafe(i,109)*4;rctx.beginPath();rctx.moveTo(x,y);rctx.bezierCurveTo(x+25,y-18,x-18,y+30,x+45,y+55);rctx.stroke();}
  const rockTex=new THREE.CanvasTexture(rockCanvas);rockTex.colorSpace=THREE.SRGBColorSpace;rockTex.wrapS=rockTex.wrapT=THREE.RepeatWrapping;rockTex.repeat.set(1.4,1.2);rockTex.anisotropy= Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const rockBump=new THREE.CanvasTexture(rockCanvas);rockBump.wrapS=rockBump.wrapT=THREE.RepeatWrapping;rockBump.repeat.copy(rockTex.repeat);
  const rockMat = new THREE.MeshStandardMaterial({ map:rockTex, bumpMap:rockBump, bumpScale:.075, color:0xb1afa4, roughness:.91, metalness:.01 });
  const wetRockMat = new THREE.MeshStandardMaterial({ map:rockTex, bumpMap:rockBump, bumpScale:.055, color:0x727e7d, roughness:.24, metalness:.035, envMapIntensity:1.1 });
  const rockRand = mulberry32(84321);
  const rockGroups = [
    { x: -112, count: 13, spread: 13 }, { x: -62, count: 9, spread: 9 },
    { x: 34, count: 12, spread: 12 }, { x: 91, count: 15, spread: 15 },
    { x: 132, count: 8, spread: 9 }
  ];
  for (const group of rockGroups) {
    for (let i = 0; i < group.count; i++) {
      const x = group.x + (rockRand() - .5) * group.spread * 2;
      const d = -2.8 + rockRand() * 8.5;
      const z = shoreZ(x) + d;
      const sx = .65 + rockRand() * 2.15, sy = .45 + rockRand() * 1.25, sz = .7 + rockRand() * 1.9;
      const submerged = d < 1.0;
      const rock = new THREE.Mesh(rockGeo, submerged ? wetRockMat : rockMat);
      rock.position.set(x, terrainH(x, z) - sy * (.22 + rockRand() * .22), z);
      rock.scale.set(sx, sy, sz);
      rock.rotation.set((rockRand() - .5) * .32, rockRand() * Math.PI * 2, (rockRand() - .5) * .3);
      rock.castShadow = true; rock.receiveShadow = true;
      scene.add(rock);
      rock.updateMatrixWorld(true);
      rockMeshes.push(rock);
      if (Math.max(sx,sz) > .95 && d > -4.8) colliders.push({ x, z, r: Math.max(.48, Math.min(sx,sz) * .62), rx: sx * .76, rz: sz * .76, rock: true, bottom: rock.position.y-sy, top: rock.position.y + sy, mesh: rock });
    }
  }

  const mountainRockRand = mulberry32(4217);
  for (let i = 0; i < 245; i++) {
    const a = mountainRockRand() * Math.PI * 2;
    const rad = 15 + mountainRockRand() * 55;
    const x = 76 + Math.cos(a) * rad;
    const z = 82 + Math.sin(a) * rad * 1.08;
    if (Math.hypot((x - 76) / 58, (z - 82) / 66) > 1.10) continue;
    const y = terrainH(x, z);
    const sx = .28 + mountainRockRand() * .72;
    const sy = .22 + mountainRockRand() * .48;
    const sz = .30 + mountainRockRand() * .78;
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, y - sy * .18, z);
    rock.scale.set(sx, sy, sz);
    rock.rotation.set((mountainRockRand() - .5) * .42, mountainRockRand() * Math.PI * 2, (mountainRockRand() - .5) * .38);
    rock.castShadow = true; rock.receiveShadow = true;
    scene.add(rock); rock.updateMatrixWorld(true); rockMeshes.push(rock);
    if (Math.max(sx, sz) > .72) colliders.push({ x, z, r: Math.max(.32, Math.min(sx, sz) * .58), rx: sx * .72, rz: sz * .72, rock: true, bottom: rock.position.y - sy, top: rock.position.y + sy, mesh: rock });
  }

  const NV = 4, variants = [];
  for (let v = 0; v < NV; v++) variants.push(buildPalm(101 + v * 17));

  const rnd = mulberry32(2024), placed = [];
  const TOTAL = 44;
  for (let tries = 0; placed.length < TOTAL && tries < 4000; tries++) {
    const x = (rnd() - .5) * 280;
    const d = 5 + Math.pow(rnd(), 1.6) * 42;
    const z = shoreZ(x) + d;
    if (Math.hypot(x, z) < 5) continue;
    if (Math.hypot(x - CAVE_DEFAULT_X, z - (shoreZ(CAVE_DEFAULT_X) + 2.2)) < 26) continue;
    if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 4.2)) continue;
    placed.push({ x, z, y: terrainH(x, z) - .15, s: .8 + rnd() * .45, rot: rnd() * Math.PI * 2, v: placed.length % NV });
  }
  const nutGeo = new THREE.SphereGeometry(.11, 8, 6);
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x5b4a2a, roughness: .8 });
  const nuts = new THREE.InstancedMesh(nutGeo, nutMat, placed.length * 4); nuts.castShadow = true; nuts.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), nm = new THREE.Matrix4(), tmp = new THREE.Vector3();
  let nutI = 0;
  for (let v = 0; v < NV; v++) {
    const list = placed.filter(p => p.v === v);
    if (!list.length) continue;
    const tm = new THREE.InstancedMesh(variants[v].trunkGeo, trunkMat, list.length);
    const fm = new THREE.InstancedMesh(variants[v].frondGeo, frondMat, list.length);
    list.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot); ps.set(p.x, p.y, p.z); sc.setScalar(p.s);
      m4.compose(ps, q, sc); tm.setMatrixAt(i, m4); fm.setMatrixAt(i, m4);
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2 + p.rot;
        tmp.set(variants[v].top.x + Math.cos(a) * .2, variants[v].top.y - .22 - (k % 2) * .08, variants[v].top.z + Math.sin(a) * .2);
        nm.makeTranslation(tmp.x, tmp.y, tmp.z);
        nuts.setMatrixAt(nutI++, new THREE.Matrix4().multiplyMatrices(m4, nm));
      }
      colliders.push({ x: p.x, z: p.z, r: .32 * p.s });
    });
    tm.castShadow = fm.castShadow = true; tm.receiveShadow = true; fm.receiveShadow = true;
    tm.frustumCulled = fm.frustumCulled = false;
    scene.add(tm); scene.add(fm);
    list.forEach((p, i) => harvestPalms.push({ id: harvestPalms.length, x: p.x, z: p.z, tm, fm, instance: i, collider: colliders.find(c => c.x === p.x && c.z === p.z), felled: false }));
  }
  nuts.count = nutI; scene.add(nuts);

  const grassTexture = makeCanvasTexture(128, 128, grassTex, { aniso, repeat: false });
  const gg = new THREE.BufferGeometry(), gp = [], gu = [], gi = [];
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3, cx = Math.cos(a) * .5, cz = Math.sin(a) * .5, b = gp.length / 3;
    gp.push(-cx, 0, -cz, cx, 0, cz, cx, .8, cz, -cx, .8, -cz);
    gu.push(0, 0, 1, 0, 1, 1, 0, 1);
    gi.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gg.setAttribute('uv', new THREE.Float32BufferAttribute(gu, 2));
  gg.setIndex(gi); gg.computeVertexNormals();
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture, alphaTest: .4, roughness: 1, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + swayCommon)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.x+=sin(uTime*1.8+instanceMatrix[3].x*.7+instanceMatrix[3].z*.5)*.07*uv.y*uv.y;`);
  };
  const grassList = [], grnd = mulberry32(555);
  for (let tries = 0; grassList.length < 900 && tries < 6000; tries++) {
    const x = (grnd() - .5) * 300, d = 12 + grnd() * 110, z = shoreZ(x) + d;
    const mountainClear = ss(104, 132, Math.hypot(x - 76, z - 82));
    const p = ss(12, 40, d) * (.35 + .65 * fbm2(x * .05, z * .05)) * mountainClear;
    if (grnd() > p) continue;
    grassList.push({ x, z, s: .7 + grnd() * .7, r: grnd() * Math.PI });
  }
  const grass = new THREE.InstancedMesh(gg, grassMat, grassList.length);
  grassList.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r); ps.set(p.x, terrainH(p.x, p.z) - .02, p.z); sc.set(p.s, p.s, p.s);
    m4.compose(ps, q, sc); grass.setMatrixAt(i, m4);
  });
  grass.frustumCulled = false;
  scene.add(grass);


  // Selva profunda: queda detrás de la cordillera de dunas, en el extremo opuesto de la playa de palmeras.
  // La vegetación se agrupa en instancias para mantener un coste razonable en equipos modestos.
  const jungleGroup = new THREE.Group();
  jungleGroup.name = 'deep-jungle';
  scene.add(jungleGroup);
  const jungleRand = mulberry32(731942);
  const jungleCenter = { x: 94, z: 137 };
  const jungleTrees = [];
  const jungleTreeCount = 0; // Árboles de la selva ocultos temporalmente.
  const jungleTrunkGeo = new THREE.CylinderGeometry(.24, .62, 1, 9, 3);
  const jungleTrunkMat = new THREE.MeshStandardMaterial({ color: 0x59402b, roughness: .96 });
  const canopyGeo = new THREE.IcosahedronGeometry(1, 2);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x31552b, roughness: .94, vertexColors: true });
  const understoryGeo = new THREE.IcosahedronGeometry(1, 1);
  const understoryMat = new THREE.MeshStandardMaterial({ color: 0x456b32, roughness: 1, vertexColors: true });
  const trees = [];
  for (let tries = 0; trees.length < jungleTreeCount && tries < 5000; tries++) {
    const a = jungleRand() * Math.PI * 2;
    const r = Math.sqrt(jungleRand());
    const x = jungleCenter.x + Math.cos(a) * r * 76;
    const z = jungleCenter.z + Math.sin(a) * r * 25;
    if (z < 111 || z > 149 || x < 14 || x > 174) continue;
    // Dejar un claro de llegada para que el personaje no aparezca dentro de un tronco.
    if (Math.hypot(x - 94, z - 145) < 10.5) continue;
    if (trees.some(p => Math.hypot(p.x - x, p.z - z) < 3.7)) continue;
    const ground = terrainH(x, z);
    const slopeX = terrainH(x + 1, z) - terrainH(x - 1, z);
    const slopeZ = terrainH(x, z + 1) - terrainH(x, z - 1);
    if (Math.hypot(slopeX, slopeZ) > 2.0) continue;
    trees.push({ x, z, y: ground - .12, h: 10.5 + jungleRand() * 7.5, rot: jungleRand() * Math.PI * 2, crown: 3.1 + jungleRand() * 1.8 });
  }
  const jungleTrunks = new THREE.InstancedMesh(jungleTrunkGeo, jungleTrunkMat, trees.length);
  const canopyInstances = trees.length * 6;
  const jungleCanopy = new THREE.InstancedMesh(canopyGeo, canopyMat, canopyInstances);
  const undergrowth = new THREE.InstancedMesh(understoryGeo, understoryMat, trees.length * 3);
  const jungleMatrix = new THREE.Matrix4(), junglePos = new THREE.Vector3(), jungleScale = new THREE.Vector3(), jungleQuat = new THREE.Quaternion();
  let canopyIndex = 0, underIndex = 0;
  const leafColors = [0x244a25, 0x315b2c, 0x3d6833, 0x496f36, 0x294f2b];
  const underColors = [0x3e642f, 0x587b39, 0x31552c, 0x6b8741];
  trees.forEach((tree, ti) => {
    junglePos.set(tree.x, tree.y + tree.h * .5, tree.z);
    jungleScale.set(1, tree.h, 1);
    jungleQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rot);
    jungleMatrix.compose(junglePos, jungleQuat, jungleScale);
    jungleTrunks.setMatrixAt(ti, jungleMatrix);
    colliders.push({ x: tree.x, z: tree.z, r: .52, rx: .58, rz: .58, bottom: tree.y, top: tree.y + tree.h });
    for (let k = 0; k < 6; k++) {
      const ang = k / 6 * Math.PI * 2 + tree.rot;
      const spread = tree.crown * (.35 + (k % 3) * .12);
      junglePos.set(tree.x + Math.cos(ang) * spread, tree.y + tree.h * (.73 + (k % 2) * .055), tree.z + Math.sin(ang) * spread);
      jungleScale.set(tree.crown * (.72 + jungleRand() * .24), tree.crown * (.52 + jungleRand() * .20), tree.crown * (.72 + jungleRand() * .24));
      jungleQuat.setFromEuler(new THREE.Euler((jungleRand() - .5) * .22, jungleRand() * Math.PI, (jungleRand() - .5) * .22));
      jungleMatrix.compose(junglePos, jungleQuat, jungleScale);
      jungleCanopy.setMatrixAt(canopyIndex, jungleMatrix);
      jungleCanopy.setColorAt(canopyIndex, new THREE.Color(leafColors[(jungleRand() * leafColors.length) | 0]));
      canopyIndex++;
    }
    for (let k = 0; k < 3; k++) {
      const ang = jungleRand() * Math.PI * 2;
      junglePos.set(tree.x + Math.cos(ang) * (1.3 + jungleRand() * 1.2), tree.y + .48 + jungleRand() * .5, tree.z + Math.sin(ang) * (1.3 + jungleRand() * 1.2));
      const size = 1.1 + jungleRand() * 1.0;
      jungleScale.set(size * 1.25, .75 + jungleRand() * .45, size);
      jungleQuat.setFromEuler(new THREE.Euler(jungleRand() * .3, ang, jungleRand() * .3));
      jungleMatrix.compose(junglePos, jungleQuat, jungleScale);
      undergrowth.setMatrixAt(underIndex, jungleMatrix);
      undergrowth.setColorAt(underIndex, new THREE.Color(underColors[(jungleRand() * underColors.length) | 0]));
      underIndex++;
    }
  });
  jungleTrunks.castShadow = jungleTrunks.receiveShadow = true;
  jungleCanopy.castShadow = jungleCanopy.receiveShadow = true;
  undergrowth.castShadow = true;
  jungleTrunks.frustumCulled = jungleCanopy.frustumCulled = undergrowth.frustumCulled = false;
  jungleCanopy.count = canopyIndex;
  undergrowth.count = underIndex;
  jungleGroup.add(jungleTrunks, jungleCanopy, undergrowth);

  // Troncos caídos y vegetación baja rompen la regularidad del bosque.
  const fallenGeo = new THREE.CylinderGeometry(.28, .38, 1, 8);
  const fallenMat = new THREE.MeshStandardMaterial({ color: 0x493b2b, roughness: 1 });
  const fallenLogs = new THREE.InstancedMesh(fallenGeo, fallenMat, 16);
  for (let k = 0; k < 16; k++) {
    const a = jungleRand() * Math.PI * 2, r = 8 + Math.sqrt(jungleRand()) * 61;
    const x = jungleCenter.x + Math.cos(a) * r, z = jungleCenter.z + Math.sin(a) * r * .32;
    const y = terrainH(x, z) + .25, length = 2.2 + jungleRand() * 3.6;
    junglePos.set(x, y, z); jungleScale.set(.8 + jungleRand() * .4, length, .8 + jungleRand() * .4);
    jungleQuat.setFromEuler(new THREE.Euler(0, jungleRand() * Math.PI * 2, Math.PI / 2 + (jungleRand() - .5) * .18));
    jungleMatrix.compose(junglePos, jungleQuat, jungleScale); fallenLogs.setMatrixAt(k, jungleMatrix);
  }
  fallenLogs.castShadow = true; fallenLogs.receiveShadow = true; fallenLogs.frustumCulled = false;
  jungleGroup.add(fallenLogs);


  // Plantas GLB reales aportadas para la nueva zona selvática.
  // Se cargan una vez y se clonan con variaciones de escala/rotación para cuidar el rendimiento.
  const jungleAssetLoader = opts.gltfLoader || new GLTFLoader();
  function scatterJungleAsset(gltf, fileName, count, minHeight, maxHeight, seed) {
    const source = gltf.scene;
    source.name = fileName.replace('.glb', '-source');
    source.updateMatrixWorld(true);
    const sourceBounds = new THREE.Box3().setFromObject(source);
    const sourceHeight = Math.max(.001, sourceBounds.max.y - sourceBounds.min.y);
    const rand = mulberry32(seed);
    const plantGroup = new THREE.Group();
    plantGroup.name = fileName.replace('.glb', '-scatter');
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 24) {
      tries++;
      const angle = rand() * Math.PI * 2;
      const radius = 5 + Math.sqrt(rand()) * 68;
      const x = jungleCenter.x + Math.cos(angle) * radius;
      const z = jungleCenter.z + Math.sin(angle) * radius * .31;
      if (x < 15 || x > 173 || z < 112 || z > 148) continue;
      if (Math.hypot(x - 94, z - 145) < 8.5) continue;
      const plant = source.clone(true);
      const targetHeight = minHeight + rand() * (maxHeight - minHeight);
      const scale = targetHeight / sourceHeight;
      plant.scale.setScalar(scale);
      plant.rotation.y = rand() * Math.PI * 2;
      plant.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(plant);
      plant.position.set(x, terrainH(x, z) - bounds.min.y, z);
      plant.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        // No se sustituyen los materiales ni las texturas originales de los GLB.
      });
      plantGroup.add(plant);
      placed++;
    }
    jungleGroup.add(plantGroup);
    console.info(`Selva: ${fileName} colocadas ${placed}/${count} plantas.`);
  }
  jungleAssetLoader.load(new URL('./sunburst-fern-standard.glb', import.meta.url).href,
    gltf => scatterJungleAsset(gltf, 'sunburst-fern-standard.glb', 78, 1.15, 2.35, 8812),
    undefined,
    error => console.error('No se pudo cargar sunburst-fern-standard.glb', error));
  jungleAssetLoader.load(new URL('./glowcap-cluster-standard.glb', import.meta.url).href,
    gltf => scatterJungleAsset(gltf, 'glowcap-cluster-standard.glb', 42, .65, 1.35, 19371),
    undefined,
    error => console.error('No se pudo cargar glowcap-cluster-standard.glb', error));

  let audio = null, muted = false;
  function startAudio(ctx) {
    if (audio || !ctx) return;
    try {
      const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + w * .029591; b1 = .985 * b1 + w * .032534; b2 = .95 * b2 + w * .048056; d[i] = (b0 + b1 + b2 + w * .1) * .5; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
      const swell = ctx.createGain(); swell.gain.value = .5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = .11;
      const ld = ctx.createGain(); ld.gain.value = .5; lfo.connect(ld).connect(swell.gain);
      const master = ctx.createGain(); master.gain.value = 0;
      src.connect(lp).connect(swell).connect(master).connect(ctx.destination);
      src.start(); lfo.start();
      audio = { ctx, master };
    } catch (e) { console.warn(e); }
  }
  function setMuted(m) { muted = !!m; }

  const SWIM = -19.4;
  let waveImpactCooldown=0, waveImpactPending=null, nextBigWaveAt=7+Math.random()*7;
  const foamPool=[];
  const foamMat=new THREE.MeshBasicMaterial({color:0xf3fbff,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide});
  const foamGeo=new THREE.CircleGeometry(1,9);
  for(let i=0;i<30;i++){const mesh=new THREE.Mesh(foamGeo,foamMat.clone());mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);foamPool.push({mesh,vel:new THREE.Vector3(),life:0,max:1,scale:.1});}
  let foamCursor=0;
  function burstFoam(x,z,power,time){
    for(let i=0;i<22;i++){
      const f=foamPool[foamCursor++%foamPool.length],a=Math.random()*Math.PI*2,rad=.25+Math.random()*1.35;
      f.mesh.position.set(x+Math.cos(a)*rad,Math.max(.025,terrainH(x,z)+.035)+Math.random()*.12,z+Math.sin(a)*rad);
      f.vel.set(Math.cos(a)*(.45+power*1.1),.35+Math.random()*.85,Math.sin(a)*(.45+power*1.1));
      f.life=f.max=.55+Math.random()*.65;f.scale=.12+Math.random()*.24;f.mesh.scale.setScalar(f.scale);f.mesh.visible=true;f.mesh.material.opacity=.68;
    }
  }
  function updateFoam(dt){for(const f of foamPool){if(!f.mesh.visible)continue;f.life-=dt;if(f.life<=0){f.mesh.visible=false;continue;}f.vel.y-=2.8*dt;f.mesh.position.addScaledVector(f.vel,dt);f.mesh.scale.multiplyScalar(1+dt*1.1);f.mesh.material.opacity=.68*(f.life/f.max);}}

  function rockSurfaceInfoAt(x,z,referenceY=Infinity) {
    if (!rockMeshes.length) return null;
    const rayY = Number.isFinite(referenceY) ? referenceY + 1.2 : 80;
    rockRayOrigin.set(x, rayY, z);
    rockRaycaster.set(rockRayOrigin, rockRayDown);
    rockRaycaster.near = 0; rockRaycaster.far = 110;
    const hits = rockRaycaster.intersectObjects(rockMeshes, false);
    if (!hits.length) return null;
    const hit = hits[0];
    if (Number.isFinite(referenceY) && hit.point.y > referenceY + .34) return null;
    return { height: hit.point.y, normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0,1,0), object: hit.object, point: hit.point.clone() };
  }
  function rockTopAt(x,z,referenceY=Infinity) { return rockSurfaceInfoAt(x,z,referenceY)?.height ?? -Infinity; }

  function wreckSurfaceInfoAt(x,z,referenceY=Infinity) {
    if (!wreckWalkableMeshes.length) return null;
    const rayY = Number.isFinite(referenceY) ? referenceY + 1.4 : 80;
    rockRayOrigin.set(x, rayY, z);
    rockRaycaster.set(rockRayOrigin, rockRayDown);
    rockRaycaster.near = 0; rockRaycaster.far = 110;
    const hits = rockRaycaster.intersectObjects(wreckWalkableMeshes, false);
    if (!hits.length) return null;
    const hit = hits[0];
    if (Number.isFinite(referenceY) && hit.point.y > referenceY + .55) return null;
    return { height: hit.point.y, normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0,1,0), type:'wood', wet:(z-shoreZ(x))<2.4, object:hit.object, point: hit.point.clone() };
  }

  function surfaceHeightAt(x,z,referenceY=Infinity) {
    const base = terrainH(x, z);
    const rockH = rockTopAt(x, z, referenceY);
    const wreckH = wreckSurfaceInfoAt(x, z, referenceY)?.height ?? -Infinity;
    const h = Math.max(base, rockH, wreckH);
    return Number.isFinite(h) ? h : base;
  }

  function surfaceInfoAt(x,z,referenceY=Infinity) {
    const terrain = terrainH(x,z);
    const rock = rockSurfaceInfoAt(x,z,referenceY);
    const wreck = wreckSurfaceInfoAt(x,z,referenceY);
    const bestNonTerrain = [rock, wreck].filter(Boolean).sort((a,b) => b.height - a.height)[0];
    if (bestNonTerrain && bestNonTerrain.height >= terrain - .015) {
      return { height:bestNonTerrain.height, normal:bestNonTerrain.normal, type:bestNonTerrain.type, wet:(z-shoreZ(x))<2.4, object:bestNonTerrain.object };
    }
    const e=.14, dx=(terrainH(x+e,z)-terrainH(x-e,z))/(2*e), dz=(terrainH(x,z+e)-terrainH(x,z-e))/(2*e);
    const normal=new THREE.Vector3(-dx,1,-dz).normalize();
    return { height:terrain, normal, type:'sand', wet:(z-shoreZ(x))<2.4, object:terrain };
  }

  function constrain(p, previous=null) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return p;
    p.x = clamp(p.x, -150, 150); p.z = clamp(p.z, -260, 150);
    if (!Number.isFinite(p.y)) p.y = terrainH(p.x, p.z);
    const sz = shoreZ(p.x) + SWIM; if (p.z < sz) p.z = sz;
    let sweptRockHit=false;
    const R_BODY = 0.42;
    if(previous && rockMeshes.length){
      const dx=p.x-previous.x,dz=p.z-previous.z,dist=Math.hypot(dx,dz);
      if(dist>.0001 && dist < 12){
        rockMoveDir.set(dx/dist,0,dz/dist);
        for(const h of [.25,.65,1.10,1.55]){
          rockMoveOrigin.set(previous.x,p.y+h,previous.z);
          rockSideRaycaster.set(rockMoveOrigin,rockMoveDir);rockSideRaycaster.near=0;rockSideRaycaster.far=dist+R_BODY;
          const hits=rockSideRaycaster.intersectObjects(rockMeshes,false);
          const hit=hits.find(v=>{const n=v.face?v.face.normal.clone().transformDirection(v.object.matrixWorld):null;return n&&Math.abs(n.y)<.82;});
          if(hit){const allowed=Math.max(0,hit.distance-R_BODY-.01);p.x=previous.x+rockMoveDir.x*allowed;p.z=previous.z+rockMoveDir.z*allowed;sweptRockHit=true;break;}
        }
      }
    }
    if (rockMeshes.length) {
      for (let iter = 0; iter < 2; iter++) {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          rockMoveDir.set(Math.cos(ang), 0, Math.sin(ang));
          rockMoveOrigin.set(p.x, p.y + 0.85, p.z);
          rockSideRaycaster.set(rockMoveOrigin, rockMoveDir);
          rockSideRaycaster.near = 0; rockSideRaycaster.far = R_BODY;
          const hits = rockSideRaycaster.intersectObjects(rockMeshes, false);
          const hit = hits.find(v => {
            const n = v.face ? v.face.normal.clone().transformDirection(v.object.matrixWorld) : null;
            return n && Math.abs(n.y) < 0.82;
          });
          if (hit && hit.distance < R_BODY) {
            const push = R_BODY - hit.distance + 0.01;
            p.x -= rockMoveDir.x * push;
            p.z -= rockMoveDir.z * push;
            sweptRockHit = true;
          }
        }
      }
    }
    for (const c of colliders) {
      if(!c.rock) { const dx=p.x-c.x,dz=p.z-c.z,rr=c.r+.35,dd=dx*dx+dz*dz;if(dd<rr*rr){const l=Math.sqrt(dd)||.001;p.x=c.x+dx/l*rr;p.z=c.z+dz/l*rr;} continue; }
      if(sweptRockHit) continue;
      const rx=c.rx||c.r, rz=c.rz||c.r, nx=(p.x-c.x)/rx,nz=(p.z-c.z)/rz,q=nx*nx+nz*nz;
      if(q<.88 && p.y<c.top-.78){const l=Math.sqrt(q)||.001;p.x=c.x+(nx/l)*rx*1.035;p.z=c.z+(nz/l)*rz*1.035;}
    }
    return p;
  }

  function fellPalm(id) {
    const p = harvestPalms.find(t => t.id === id);
    if (!p || p.felled) return false;
    p.felled = true;
    const zero = new THREE.Matrix4().compose(new THREE.Vector3(p.x, -1000, p.z), new THREE.Quaternion(), new THREE.Vector3(.0001,.0001,.0001));
    p.tm.setMatrixAt(p.instance, zero); p.fm.setMatrixAt(p.instance, zero);
    p.tm.instanceMatrix.needsUpdate = true; p.fm.instanceMatrix.needsUpdate = true;
    if (p.collider) { const i = colliders.indexOf(p.collider); if (i >= 0) colliders.splice(i,1); }
    return true;
  }

  function update(dt, time, pp, camera, stormIntensity=0) {
    const safeDt = Number.isFinite(dt) ? Math.min(dt, 0.1) : 0.016;
    const safeTime = Number.isFinite(time) ? time : 0;
    const storm=THREE.MathUtils.clamp(Number.isFinite(stormIntensity) ? stormIntensity : 0,0,1);
    uTime.value = safeTime * (1 + storm * .055);
    waveImpactCooldown=Math.max(0,waveImpactCooldown-safeDt);
    const shelteredInCave = typeof api.isInsideCave === 'function' && api.isInsideCave(pp.x, pp.z);
    const shoreDist=pp.z-shoreZ(pp.x), swell=(Math.sin(safeTime*.47+pp.x*.065)+.32*Math.sin(safeTime*.91+pp.x*.12))*(1+storm*.34);
    const inWaterReach=!shelteredInCave && shoreDist>-4.8 && shoreDist<2.8;
    const bigSetDue=safeTime>=nextBigWaveAt;
    const ordinaryHit=swell>(1.16-storm*.22) && shoreDist>-2.8 && shoreDist<2.4;
    if(!shelteredInCave && waveImpactCooldown<=0 && inWaterReach && (bigSetDue || ordinaryHit)){
      const deepFactor=clamp((-shoreDist+1.2)/5.5,0,1);
      const strength=bigSetDue ? clamp(.72+Math.random()*.62+deepFactor*.28+storm*.38,.72,1.9) : clamp((swell-(1.16-storm*.22))*1.45+storm*.12,.16,1.02);
      const dirX=clamp(-.22*Math.sin(pp.x*.07+safeTime*.2)+(.5-Math.random())*.10,-.30,.30),dirZ=shoreDist<-.5?1:.86;
      pp.z+=.12+strength*.42;
      waveImpactPending={strength,dirX,dirZ,x:pp.x,z:pp.z-.15,big:bigSetDue};
      burstFoam(pp.x,pp.z-.15,strength,safeTime);
      waveImpactCooldown=bigSetDue?(6.5-storm*1.8)+Math.random()*(3.5-storm*.8):(4.2-storm*.7)+Math.random()*(2.8-storm*.5);
      if(bigSetDue)nextBigWaveAt=safeTime+(10-storm*3)+Math.random()*(13-storm*4);
    }
    updateFoam(safeDt);
    if (camera?.position) dome.position.copy(camera.position);
    if (sun) {
      sun.position.set(pp.x + sunDir.x * 60, pp.y + sunDir.y * 60, pp.z + sunDir.z * 60);
      sun.target.position.set(pp.x, pp.y, pp.z); sun.target.updateMatrixWorld();
    }
    if (audio) {
      const dw = Math.max(0, pp.z - shoreZ(pp.x)); const fade = 1 - THREE.MathUtils.smoothstep(dw, 28, 155); const vol = muted ? 0 : .115 * fade * fade;
      audio.master.gain.setTargetAtTime(vol, audio.ctx.currentTime, .3);
    }
  }

  function consumeWaveImpact(){const v=waveImpactPending;waveImpactPending=null;return v;}
  const api = { sunDir, rockMeshes, wreckWalkableMeshes, shipwreckGroup, isInsideCave: null, heightAt: terrainH, surfaceHeightAt, surfaceInfoAt, rockTopAt, shoreZ, constrain, update, consumeWaveImpact, startAudio, setMuted, colliders, harvestPalms, grassPatches: grassList, fellPalm, terrain, water, dome };
  return api;
}

export const BeachWorld = { create, shoreZ, terrainH };