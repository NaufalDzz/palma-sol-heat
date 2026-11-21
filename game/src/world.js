// The coastal city of Palma Sol, generated from a seed: a turquoise ocean with a foam shoreline,
// a golden beach with striped umbrellas, lifeguard towers and beachgoers, the palm-lined Ocean
// Drive boulevard with crosswalks and streetlamps, Art Deco pastel hotels with neon signs, a
// grid of inland blocks rising to the Solar Centro towers, the Neon Mercado boardwalk market and
// a hazy far skyline. Static geometry is merged per material so the whole city is a few dozen
// draw calls. applyLightingPreset switches between golden hour, neon night and the showroom.
import * as THREE from 'three';
import { WORLD, createSeededRandom } from './config.js';
import { buildHumanoid } from './player.js';

const PASTELS = [0xffc9b5, 0xffe3a3, 0xb8f0e0, 0xf9b8d0, 0xc9d8ff, 0xfff1dc, 0xa8e6f0, 0xffd0a0];
const NEON_NAMES = [
  ['HOTEL FLAMINGA', '#ff4fb8'], ['CASA CORAL', '#46e0ff'], ['SOL Y MAR', '#ffcf4a'], ['THE SANDPIPER', '#7dff9b'],
  ['PALM COURT', '#ff7a59'], ['MIRAMAR', '#c08bff'], ['LUNA BAR', '#46e0ff'], ['NEON TIKI', '#ff4fb8'],
  ['GRAN BRISA', '#ffcf4a'], ['THE ORCHID', '#ff7ad9'], ['OCEANA', '#5cf2ff'], ['COCO LOUNGE', '#ffa64a'],
];

// ---------------------------------------------------------------------------------------------
// Geometry helpers

/** Merge many BufferGeometries (indexed or not) into one non-indexed geometry with normals, uvs and optional colours. */
export function mergeGeometries(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const withColor = parts.every((g) => g.attributes.color);
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = withColor ? new Float32Array(count * 3) : null;
  let o = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
    nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    if (col) col.set(g.attributes.color.array.subarray(0, n * 3), o * 3);
    o += n;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.computeBoundingSphere();
  return merged;
}

/** A geometry moved, rotated and scaled in place (returns the same geometry for chaining). */
export function placed(geo, x, y, z, ry = 0, rx = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(s, s, s),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Paint every vertex of a geometry one colour (for vertex-coloured merged meshes). */
export function tinted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** A texture painted by a 2D canvas callback. */
export function canvasTexture(w, h, draw, { repeat = false, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Soft round glow texture used by sprites (lights, fire, flashes). */
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Rescale the uvs of a BoxGeometry so window cells repeat at a fixed size on its four walls. */
function scaleBoxUVs(geo, w, h, d, cellW, cellH) {
  const uv = geo.attributes.uv;
  const faceSize = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]];
  for (let f = 0; f < 6; f += 1) {
    const [fw, fh] = faceSize[f];
    for (let v = 0; v < 4; v += 1) {
      const i = f * 4 + v;
      if (fw === 0) uv.setXY(i, 0.02, 0.02);
      else uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fw / cellW)), uv.getY(i) * Math.max(1, Math.round(fh / cellH)));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Textures

function makeFacadeTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#e9e4dc';
    ctx.fillRect(0, 100, 128, 28);
    const g = ctx.createLinearGradient(0, 22, 0, 92);
    g.addColorStop(0, '#9fd8e8');
    g.addColorStop(0.5, '#3f7f9e');
    g.addColorStop(1, '#22465e');
    ctx.fillStyle = '#d8d2c8';
    ctx.fillRect(18, 18, 92, 80);
    ctx.fillStyle = g;
    ctx.fillRect(24, 24, 80, 68);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(24, 70); ctx.lineTo(70, 24); ctx.lineTo(86, 24); ctx.lineTo(24, 86); ctx.fill();
    ctx.fillStyle = '#d8d2c8';
    ctx.fillRect(62, 24, 4, 68);
    ctx.fillStyle = '#c9c1b5';
    ctx.fillRect(14, 98, 100, 6);
  }, { repeat: true });
}

function makeNightWindowTexture(rng) {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 256);
    const warm = ['#ffd27a', '#ffb45c', '#fff0c2', '#9fe8ff', '#ff9ad5'];
    for (let cy = 0; cy < 8; cy += 1) {
      for (let cx = 0; cx < 8; cx += 1) {
        if (rng() < 0.42) continue;
        ctx.fillStyle = warm[Math.floor(rng() * warm.length)];
        ctx.globalAlpha = 0.55 + rng() * 0.45;
        ctx.fillRect(cx * 32 + 6, cy * 32 + 6, 20, 17);
      }
    }
    ctx.globalAlpha = 1;
  }, { repeat: true });
}

function makeAsphaltTexture(kind) {
  // kind 'boulevard' (4 lanes, 22 m), 'street' (2 lanes). The texture spans the road width (u) and 16 m (v).
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3b3d44';
    ctx.fillRect(0, 0, w, h);
    const rng = createSeededRandom(kind === 'boulevard' ? 11 : 12);
    for (let i = 0; i < 2600; i += 1) {
      const v = 50 + rng() * 30;
      ctx.fillStyle = `rgba(${v},${v},${v + 6},0.5)`;
      ctx.fillRect(rng() * w, rng() * h, 1.5, 1.5);
    }
    ctx.fillStyle = 'rgba(20,20,24,0.25)';
    ctx.fillRect(w * 0.18, 0, w * 0.12, h);
    ctx.fillRect(w * 0.7, 0, w * 0.12, h);
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(4, 0, 4, h);
    ctx.fillRect(w - 8, 0, 4, h);
    if (kind === 'boulevard') {
      ctx.fillStyle = '#ffc93a';
      ctx.fillRect(w / 2 - 6, 0, 4, h);
      ctx.fillRect(w / 2 + 2, 0, 4, h);
      ctx.fillStyle = '#f2efe6';
      for (const fx of [0.25, 0.75]) ctx.fillRect(w * fx - 2, 0, 4, h * 0.45);
    } else {
      ctx.fillStyle = '#ffc93a';
      ctx.fillRect(w / 2 - 2, 0, 4, h * 0.5);
    }
  }, { repeat: true });
}

function makeSandTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f0d39a';
    ctx.fillRect(0, 0, w, h);
    const rng = createSeededRandom(5);
    for (let i = 0; i < 5000; i += 1) {
      const t = rng();
      ctx.fillStyle = t < 0.5 ? 'rgba(255,240,205,0.5)' : 'rgba(196,158,98,0.35)';
      ctx.fillRect(rng() * w, rng() * h, 1.6, 1.6);
    }
    ctx.strokeStyle = 'rgba(205,168,110,0.25)';
    for (let i = 0; i < 18; i += 1) {
      ctx.beginPath();
      const y = rng() * h;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + 8, w * 0.6, y - 8, w, y + 3);
      ctx.stroke();
    }
  }, { repeat: true });
}

function makePaverTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#d9cfc0';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#b9ad9b';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillRect(64, 64, 64, 64);
  }, { repeat: true });
}

function makePlankTexture() {
  return canvasTexture(256, 256, (ctx) => {
    const rng = createSeededRandom(77);
    for (let i = 0; i < 16; i += 1) {
      const v = 120 + rng() * 40;
      ctx.fillStyle = `rgb(${v},${v * 0.72},${v * 0.5})`;
      ctx.fillRect(0, i * 16, 256, 16);
      ctx.fillStyle = 'rgba(40,24,12,0.6)';
      ctx.fillRect(0, i * 16 + 15, 256, 1);
      ctx.fillRect(rng() * 256, i * 16, 2, 16);
    }
  }, { repeat: true });
}

function makeFrondTexture() {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#4c7a2a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    for (let i = 4; i < w - 4; i += 6) {
      const len = (h / 2 - 2) * Math.sin((i / w) * Math.PI * 0.95 + 0.15);
      const shade = 90 + ((i * 37) % 50);
      ctx.strokeStyle = `rgb(${40 + (shade >> 2)},${shade + 40},${30 + (shade >> 3)})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(i, h / 2); ctx.lineTo(i + 10, h / 2 - len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, h / 2); ctx.lineTo(i + 10, h / 2 + len); ctx.stroke();
    }
  });
}

function makeTrunkTexture() {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      ctx.fillStyle = '#6b4f34';
      ctx.fillRect(0, y, 64, 3);
      ctx.fillStyle = '#a3825c';
      ctx.fillRect(0, y + 3, 64, 1);
    }
  }, { repeat: true });
}

/** A neon sign texture: glowing tube lettering on a transparent background. */
export function makeNeonTexture(text, color, { w = 512, h = 128, font = 'bold 76px "Nimbus Sans Narrow", "Noto Sans", sans-serif' } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 1;
    const measured = ctx.measureText(text).width;
    if (measured > w * 0.92) size = (w * 0.92) / measured;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(size, 1);
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 4);
    ctx.shadowBlur = 8;
    ctx.fillText(text, 0, 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = font.replace(/\d+px/, (m) => `${Math.round(parseInt(m, 10) * 0.98)}px`);
    ctx.globalAlpha = 0.55;
    ctx.fillText(text, 0, 4);
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------------------------
// Sky and ocean shaders

const SKY_PRESETS = {
  golden: { zenith: 0x3c4c9c, mid: 0xf28c7c, horizon: 0xffc76a, sun: 0xfff0c0, sunDir: [-0.86, 0.17, -0.3], stars: 0, clouds: 0.85, cloudTint: 0xffa48a },
  night: { zenith: 0x060820, mid: 0x1c1250, horizon: 0x5a1f6e, sun: 0xbfd4ff, sunDir: [0.3, 0.35, -0.9], stars: 1, clouds: 0.35, cloudTint: 0x6a2f8a },
};

function createSky(preset) {
  const p = SKY_PRESETS[preset];
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(p.zenith) },
      mid: { value: new THREE.Color(p.mid) },
      horizon: { value: new THREE.Color(p.horizon) },
      sunColor: { value: new THREE.Color(p.sun) },
      sunDir: { value: new THREE.Vector3(...p.sunDir).normalize() },
      stars: { value: p.stars },
      clouds: { value: p.clouds },
      cloudTint: { value: new THREE.Color(p.cloudTint) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 zenith, mid, horizon, sunColor, sunDir, cloudTint; uniform float stars, clouds; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, h));
        col = mix(col, zenith, smoothstep(0.14, 0.6, h));
        col = mix(col, horizon*0.85, smoothstep(0.0, -0.08, h));
        float sd = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(sd, 6.0)*0.35 + pow(sd, 60.0)*0.6) ;
        col = mix(col, sunColor*1.6, smoothstep(0.9993, 0.9997, sd));
        vec2 cp = d.xz / max(h + 0.12, 0.04);
        float n = noise(cp*vec2(1.2,4.5)) * 0.6 + noise(cp*vec2(2.7,9.0)) * 0.4;
        float band = smoothstep(0.02, 0.1, h) * (1.0 - smoothstep(0.28, 0.5, h));
        float c = smoothstep(0.55, 0.85, n) * band * clouds;
        col = mix(col, cloudTint * (0.9 + 0.5*pow(sd,4.0)), c*0.75);
        if (stars > 0.0) { vec2 sp = floor(d.xz/(h+0.3)*220.0); float s = step(0.996, hash(sp)) * smoothstep(0.08, 0.4, h); col += vec3(s)*0.9; }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 20), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

function createOcean(preset) {
  const night = preset === 'night';
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 },
      sunDir: { value: new THREE.Vector3(...SKY_PRESETS[preset].sunDir).normalize() },
      sunColor: { value: new THREE.Color(night ? 0x9fb6ff : 0xffe2a8) },
      shallow: { value: new THREE.Color(night ? 0x0f4a6a : 0x34e0d0) },
      deep: { value: new THREE.Color(night ? 0x061632 : 0x0a6f9c) },
      skyTint: { value: new THREE.Color(night ? 0x2a1450 : 0xffb48a) },
      shoreX: { value: WORLD.oceanEdgeX },
    }]),
    vertexShader: `
      varying vec3 vWorld; #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
    fragmentShader: `
      uniform float time, shoreX; uniform vec3 sunDir, sunColor, shallow, deep, skyTint; varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vWorld.xz;
        float w1 = sin(p.x*0.35 + p.y*0.12 + time*1.3), w2 = sin(p.x*0.11 - p.y*0.41 + time*0.9), w3 = sin((p.x+p.y)*0.9 + time*2.1);
        vec3 n = normalize(vec3(w1*0.12 + w3*0.05, 1.0, w2*0.12 + w3*0.05));
        vec3 v = normalize(cameraPosition - vWorld);
        float dist = clamp((shoreX - vWorld.x) / 90.0, 0.0, 1.0);
        vec3 col = mix(shallow, deep, smoothstep(0.0, 1.0, dist));
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col = mix(col, skyTint, fres*0.55);
        vec3 r = reflect(-v, n);
        float spec = pow(max(dot(r, sunDir), 0.0), 140.0);
        col += sunColor * spec * 2.2;
        float foam = smoothstep(0.92, 1.0, w3*0.5+0.5) * (1.0 - smoothstep(0.0, 0.15, dist));
        col = mix(col, vec3(1.0), foam*0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), mat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WORLD.oceanEdgeX - 1200 + 8, -0.25, 0);
  ocean.receiveShadow = false;
  return ocean;
}

function makeFoamTexture() {
  return canvasTexture(512, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let band = 0; band < 3; band += 1) {
      ctx.beginPath();
      const base = 14 + band * 16;
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin(x * 0.05 + band * 2) * 5 + Math.sin(x * 0.13) * 3);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${0.75 - band * 0.22})`;
      ctx.fill();
    }
  }, { repeat: true });
}

// ---------------------------------------------------------------------------------------------
// Props

const PALM_VARIANTS = [];

/** Build (once) and return three palm variants: { trunk, fronds } geometries with tall curved trunks and many drooping fronds. */
function palmVariants(materials) {
  if (PALM_VARIANTS.length) return PALM_VARIANTS;
  for (let v = 0; v < 3; v += 1) {
    const rng = createSeededRandom(100 + v);
    const height = 9 + v * 1.8;
    const lean = 0.6 + rng() * 1.2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 0.2, height * 0.35, 0),
      new THREE.Vector3(lean * 0.65, height * 0.7, 0),
      new THREE.Vector3(lean, height, 0),
    ]);
    const trunk = new THREE.TubeGeometry(curve, 10, 0.24, 7, false);
    const pos = trunk.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const t = Math.floor(i / 8) / 10;
      const center = curve.getPoint(Math.min(t, 1));
      const scale = 1.35 - t * 0.5;
      pos.setX(i, center.x + (pos.getX(i) - center.x) * scale);
      pos.setZ(i, center.z + (pos.getZ(i) - center.z) * scale);
    }
    const uv = trunk.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 2, uv.getY(i));
    trunk.computeVertexNormals();
    const top = curve.getPoint(1);
    const fronds = [];
    const count = 11;
    for (let f = 0; f < count; f += 1) {
      const len = 4.4 + rng() * 1.4;
      const leaf = new THREE.PlaneGeometry(len, 1.5, 10, 2);
      const lp = leaf.attributes.position;
      const lift = 0.35 + rng() * 0.35;
      for (let i = 0; i < lp.count; i += 1) {
        const x = lp.getX(i) + len / 2;
        const y = lp.getY(i);
        const t = x / len;
        const droop = lift * x - 0.11 * x * x * (1 + rng() * 0.02);
        lp.setXYZ(i, x, droop - Math.abs(y) * 0.45, y * (1 - t * 0.35));
      }
      leaf.computeVertexNormals();
      const yaw = (f / count) * Math.PI * 2 + rng() * 0.3;
      placed(leaf, top.x, top.y - 0.15, top.z, yaw, 0, 0);
      fronds.push(leaf);
    }
    const nuts = [];
    for (let n = 0; n < 4; n += 1) nuts.push(placed(new THREE.SphereGeometry(0.22, 6, 5), top.x + Math.cos(n * 1.7) * 0.3, top.y - 0.45, top.z + Math.sin(n * 1.7) * 0.3));
    PALM_VARIANTS.push({ trunk, fronds: mergeGeometries(fronds), nuts: mergeGeometries(nuts) });
  }
  return PALM_VARIANTS;
}

/** A striped beach umbrella (vertex-coloured), its pole and towel, merged into one geometry. */
function umbrellaGeometry(x, z, colorA, colorB, tilt) {
  const parts = [];
  const canopy = new THREE.ConeGeometry(1.9, 0.75, 12, 1, true).toNonIndexed();
  const cols = new Float32Array(canopy.attributes.position.count * 3);
  const a = new THREE.Color(colorA);
  const b = new THREE.Color(colorB);
  for (let i = 0; i < canopy.attributes.position.count; i += 1) {
    const tri = Math.floor(i / 3);
    const c = tri % 2 === 0 ? a : b;
    cols.set([c.r, c.g, c.b], i * 3);
  }
  canopy.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  parts.push(placed(canopy, x, 2.55, z, 0, tilt, tilt * 0.6));
  parts.push(placed(tinted(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), 0xf4f1ea), x, 1.3, z, 0, tilt, tilt * 0.6));
  parts.push(placed(tinted(new THREE.BoxGeometry(0.9, 0.03, 1.9), colorB), x + 1.2, 0.03, z + 0.4, 0.3));
  return parts;
}

/** A lifeguard tower: stilts, a striped hut, a ramp and a flag. */
function lifeguardTower(x, z) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff4a3d, roughness: 0.6 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x2fd3c6, roughness: 0.6 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), wood);
    leg.position.set(sx * 1.1, 1.3, sz * 1.1);
    g.add(leg);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 3.4), wood);
  deck.position.y = 2.6;
  g.add(deck);
  const hut = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.7, 2.5), teal);
  hut.position.y = 3.55;
  g.add(hut);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.38, 2.56), red);
  stripe.position.y = 3.6;
  g.add(stripe);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 1.6), new THREE.MeshStandardMaterial({ color: 0x1d3442, roughness: 0.2, metalness: 0.4 }));
  win.position.set(0, 3.95, 0);
  g.add(win);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 0.9, 4), red);
  roof.position.y = 4.85;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 4.2), wood);
  ramp.position.set(2.4, 1.3, 0);
  ramp.rotation.z = 0.62;
  ramp.rotation.y = Math.PI / 2;
  ramp.rotation.order = 'YXZ';
  ramp.position.set(0, 1.3, 2.9);
  ramp.rotation.set(0.66, 0, 0);
  g.add(ramp);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2), wood);
  pole.position.set(1.1, 6.1, 1.1);
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: 0xffd23f, side: THREE.DoubleSide }));
  flag.position.set(1.55, 6.9, 1.1);
  g.add(flag);
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2;
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// ---------------------------------------------------------------------------------------------
// The city

/**
 * Build the whole coastal city into a new scene.
 * @param {{seed?: number, preset?: 'golden'|'night'}} options
 * @returns {{scene, colliders, neon, lamps, update, sun, preset, focus}}
 */
export function buildCoastalCity({ seed = 1, preset = 'golden' } = {}) {
  const rng = createSeededRandom(seed * 7919 + 13);
  const scene = new THREE.Scene();
  const colliders = [];
  const neonSigns = [];
  const animated = [];

  const facadeTex = makeFacadeTexture();
  const nightTex = makeNightWindowTexture(createSeededRandom(seed + 3));
  nightTex.repeat.set(0.125, 0.125);
  const pastelMats = PASTELS.map((c) => new THREE.MeshStandardMaterial({ color: c, map: facadeTex, emissiveMap: nightTex, emissive: 0x000000, roughness: 0.78 }));
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x7fb4d6, map: facadeTex, emissiveMap: nightTex, emissive: 0x000000, roughness: 0.25, metalness: 0.55 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xfbf7f0, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xbab3a8, roughness: 0.9 });
  const vcolMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });

  const wallGroups = PASTELS.map(() => []);
  const glassGroup = [];
  const trims = [];
  const roofs = [];
  const props = [];

  // Ground plane, sand, ocean, sky.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1600), new THREE.MeshStandardMaterial({ color: 0xcfc6b6, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WORLD.cityMaxX / 2 + 300, -0.02, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const sandTex = makeSandTexture();
  sandTex.repeat.set(10, 220);
  const beachWidth = WORLD.beachInnerX - WORLD.oceanEdgeX + 24;
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(beachWidth, 1400), new THREE.MeshStandardMaterial({ map: sandTex, color: 0xffffff, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(WORLD.oceanEdgeX - 12 + beachWidth / 2, 0.0, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const wetSand = new THREE.Mesh(new THREE.PlaneGeometry(14, 1400), new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.35, metalness: 0.1 }));
  wetSand.rotation.x = -Math.PI / 2;
  wetSand.position.set(WORLD.oceanEdgeX - 1, 0.01, 0);
  scene.add(wetSand);

  const foamTex = makeFoamTexture();
  foamTex.repeat.set(1, 40);
  for (let band = 0; band < 2; band += 1) {
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(7, 1400), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.85 - band * 0.35 }));
    foam.rotation.x = -Math.PI / 2;
    foam.rotation.z = -Math.PI / 2;
    foam.geometry.rotateZ(Math.PI / 2);
    foam.rotation.z = 0;
    foam.position.set(WORLD.oceanEdgeX + 3 - band * 9, 0.05 + band * 0.01, 0);
    scene.add(foam);
    animated.push((t) => { foamTex.offset.x = Math.sin(t * 0.6) * 0.03; foam.position.x = WORLD.oceanEdgeX + 3 - band * 9 + Math.sin(t * 0.8 + band) * 0.8; });
  }
  scene.add(createOcean(preset));
  scene.add(createSky(preset));

  // Roads: Ocean Drive, the inland avenues (parallel) and the cross streets.
  const roadLen = WORLD.maxZ - WORLD.minZ + 80;
  const blvdTex = makeAsphaltTexture('boulevard');
  blvdTex.repeat.set(1, roadLen / 16);
  const roadMatProps = { roughness: preset === 'night' ? 0.32 : 0.62, metalness: 0.05 };
  const blvd = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.boulevardHalfWidth * 2, roadLen), new THREE.MeshStandardMaterial({ map: blvdTex, ...roadMatProps }));
  blvd.rotation.x = -Math.PI / 2;
  blvd.position.set(0, 0.02, 0);
  blvd.receiveShadow = true;
  scene.add(blvd);

  const streetTex = makeAsphaltTexture('street');
  const streetMat = new THREE.MeshStandardMaterial({ map: streetTex, ...roadMatProps });
  const avenueTex = streetTex.clone();
  avenueTex.repeat.set(1, roadLen / 16);
  avenueTex.needsUpdate = true;
  for (const ax of WORLD.avenueXs) {
    const av = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.avenueWidth, roadLen), new THREE.MeshStandardMaterial({ map: avenueTex, ...roadMatProps }));
    av.rotation.x = -Math.PI / 2;
    av.position.set(ax, 0.02, 0);
    av.receiveShadow = true;
    scene.add(av);
  }
  const crossLen = WORLD.cityMaxX - WORLD.boulevardHalfWidth;
  const crossTex = streetTex.clone();
  crossTex.repeat.set(1, crossLen / 16);
  crossTex.needsUpdate = true;
  const crossMat = new THREE.MeshStandardMaterial({ map: crossTex, ...roadMatProps });
  const plainAsphalt = new THREE.MeshStandardMaterial({ color: 0x3b3d44, ...roadMatProps });
  const crosswalks = [];
  for (const sz of WORLD.streetZs) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.streetWidth, crossLen), crossMat);
    st.rotation.x = -Math.PI / 2;
    st.rotation.z = Math.PI / 2;
    st.position.set(WORLD.boulevardHalfWidth + crossLen / 2, 0.03, sz);
    st.receiveShadow = true;
    scene.add(st);
    for (const ix of [0, ...WORLD.avenueXs]) {
      const w = ix === 0 ? WORLD.boulevardHalfWidth * 2 : WORLD.avenueWidth;
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, WORLD.streetWidth), plainAsphalt);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(ix, 0.04, sz);
      patch.receiveShadow = true;
      scene.add(patch);
      // Zebra crosswalks on both sides of every junction.
      for (const side of [-1, 1]) {
        const cz = sz + side * (WORLD.streetWidth / 2 + 1.8);
        for (let s = -w / 2 + 0.8; s < w / 2 - 0.4; s += 1.4) crosswalks.push(placed(new THREE.BoxGeometry(0.75, 0.02, 3), ix + s + 0.35, 0.05, cz));
      }
    }
  }
  const zebra = new THREE.Mesh(mergeGeometries(crosswalks), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.6 }));
  zebra.receiveShadow = true;
  scene.add(zebra);

  // Sidewalks and the beach promenade.
  const paverTex = makePaverTexture();
  const sidewalkParts = [];
  const curbH = 0.16;
  sidewalkParts.push(placed(new THREE.BoxGeometry(6, curbH, roadLen), WORLD.boulevardHalfWidth + 3, curbH / 2, 0));
  sidewalkParts.push(placed(new THREE.BoxGeometry(WORLD.beachInnerX * -1 - WORLD.boulevardHalfWidth, curbH, roadLen), (WORLD.beachInnerX - WORLD.boulevardHalfWidth) / 2, curbH / 2, 0));
  for (const ax of WORLD.avenueXs) {
    for (const side of [-1, 1]) sidewalkParts.push(placed(new THREE.BoxGeometry(3.5, curbH, roadLen), ax + side * (WORLD.avenueWidth / 2 + 1.75), curbH / 2, 0));
  }
  const sideGeo = mergeGeometries(sidewalkParts);
  const uvs = sideGeo.attributes.uv;
  const sp = sideGeo.attributes.position;
  for (let i = 0; i < uvs.count; i += 1) uvs.setXY(i, sp.getX(i) / 3, sp.getZ(i) / 3);
  const sidewalks = new THREE.Mesh(sideGeo, new THREE.MeshStandardMaterial({ map: paverTex, color: 0xffffff, roughness: 0.85 }));
  sidewalks.receiveShadow = true;
  scene.add(sidewalks);
  // Promenade sea wall: low white wall with a teal cap.
  props.push(placed(tinted(new THREE.BoxGeometry(0.5, 0.9, roadLen), 0xf7f3ea), WORLD.beachInnerX + 0.3, 0.45, 0));
  props.push(placed(tinted(new THREE.BoxGeometry(0.7, 0.12, roadLen), 0x2fbfb3), WORLD.beachInnerX + 0.3, 0.95, 0));

  // Palms: along the promenade, the right-hand sidewalk and the inland avenues.
  const variants = palmVariants();
  const trunkMat = new THREE.MeshStandardMaterial({ map: makeTrunkTexture(), roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({ map: makeFrondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: 0xd8ffb0 });
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x6b4a22, roughness: 0.8 });
  const palmSpots = [];
  for (let z = WORLD.minZ; z < WORLD.maxZ; z += 17) {
    palmSpots.push([-17.5 + rng.range(-0.6, 0.6), z + rng.range(-2, 2)]);
    palmSpots.push([WORLD.boulevardHalfWidth + 3.6, z + 8 + rng.range(-1, 1)]);
  }
  for (let z = WORLD.minZ; z < WORLD.maxZ; z += 34) for (const ax of WORLD.avenueXs) palmSpots.push([ax - WORLD.avenueWidth / 2 - 1.8, z]);
  for (let i = 0; i < 46; i += 1) palmSpots.push([rng.range(WORLD.oceanEdgeX + 14, WORLD.beachInnerX - 4), rng.range(WORLD.minZ, WORLD.maxZ)]);
  const palmGroups = variants.map(() => ({ trunks: [], fronds: [], nuts: [] }));
  for (const [x, z] of palmSpots) {
    if (WORLD.streetZs.some((sz) => Math.abs(z - sz) < 9) && x > 0) continue;
    const vi = Math.floor(rng() * variants.length);
    const ry = rng() * Math.PI * 2;
    const s = 0.9 + rng() * 0.3;
    palmGroups[vi].trunks.push(placed(variants[vi].trunk.clone(), x, 0, z, ry, 0, 0, s));
    palmGroups[vi].fronds.push(placed(variants[vi].fronds.clone(), x, 0, z, ry, 0, 0, s));
    palmGroups[vi].nuts.push(placed(variants[vi].nuts.clone(), x, 0, z, ry, 0, 0, s));
  }
  for (const grp of palmGroups) {
    if (!grp.trunks.length) continue;
    const t = new THREE.Mesh(mergeGeometries(grp.trunks), trunkMat);
    const f = new THREE.Mesh(mergeGeometries(grp.fronds), frondMat);
    const n = new THREE.Mesh(mergeGeometries(grp.nuts), nutMat);
    for (const m of [t, f, n]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }

  // Beach life: umbrellas, towels, lifeguard towers, beachgoers, a volleyball net.
  const umbrellaPalette = [[0xff4a3d, 0xffffff], [0x2fd3c6, 0xffffff], [0xffc23a, 0xff6f91], [0x4f8bff, 0xffe3a3], [0xff7a59, 0x2fd3c6]];
  const beachParts = [];
  for (let z = WORLD.minZ + 10; z < 120; z += 9 + rng() * 7) {
    const [a, b] = rng.pick(umbrellaPalette);
    beachParts.push(...umbrellaGeometry(rng.range(WORLD.oceanEdgeX + 12, WORLD.beachInnerX - 6), z, a, b, rng.range(-0.12, 0.12)));
  }
  for (const tz of [-150, -10, -330, 60, -460]) scene.add(lifeguardTower(WORLD.oceanEdgeX + 22, tz));
  const netPost = 0xf4f1ea;
  beachParts.push(placed(tinted(new THREE.CylinderGeometry(0.06, 0.06, 2.5), netPost), -48, 1.25, -205));
  beachParts.push(placed(tinted(new THREE.CylinderGeometry(0.06, 0.06, 2.5), netPost), -48, 1.25, -197));
  beachParts.push(placed(tinted(new THREE.BoxGeometry(0.04, 0.9, 8), 0xffffff), -48, 2.05, -201));
  const beachMesh = new THREE.Mesh(mergeGeometries(beachParts), vcolMat);
  beachMesh.castShadow = true;
  beachMesh.receiveShadow = true;
  scene.add(beachMesh);
  const swimColors = [0xff4a3d, 0x2fd3c6, 0xffc23a, 0xff6f91, 0x4f8bff, 0xffffff];
  const skinTones = [0xf0c7a2, 0xc98e62, 0x8a5a3c, 0xe2a982, 0x5e3b26];
  const people = [];
  for (let i = 0; i < 70; i += 1) {
    const person = buildHumanoid({ skin: rng.pick(skinTones), shirt: rng() < 0.5 ? rng.pick(skinTones) : rng.pick(swimColors), pants: rng.pick(swimColors), hair: 0x22180f, scale: 0.95 + rng() * 0.12 });
    const onBeach = i < 46;
    const x = onBeach ? rng.range(WORLD.oceanEdgeX + 6, WORLD.beachInnerX - 4) : (rng() < 0.5 ? rng.range(-23, -15) : rng.range(12, 16.5));
    const z = rng.range(WORLD.minZ + 20, onBeach ? 140 : 400);
    person.position.set(x, onBeach ? 0 : 0.16, z);
    person.rotation.y = rng() * Math.PI * 2;
    if (onBeach && rng() < 0.3) { person.rotation.x = -Math.PI / 2; person.position.y = 0.18; }
    person.userData.walk = !onBeach && rng() < 0.7;
    person.userData.speed = 1 + rng() * 0.6;
    person.userData.dir = rng() < 0.5 ? 1 : -1;
    if (person.userData.walk) person.rotation.y = person.userData.dir > 0 ? 0 : Math.PI;
    scene.add(person);
    people.push(person);
  }
  animated.push((t, dt) => {
    for (const p of people) {
      if (!p.userData.walk) continue;
      p.position.z += p.userData.dir * p.userData.speed * dt;
      if (p.position.z > 420) p.position.z = WORLD.minZ + 20;
      if (p.position.z < WORLD.minZ + 20) p.position.z = 420;
      p.userData.animateWalk?.(t * p.userData.speed * 5);
    }
  });

  // Ocean Drive hotels: Art Deco pastel fronts, eyebrow ledges, rounded corner towers and neon signs.
  const signMeshes = [];
  let neonIndex = 0;
  for (let z = WORLD.minZ + 10; z < WORLD.maxZ - 30;) {
    const depth = 22 + rng() * 10;
    const width = 20 + rng() * 14;
    const nextStreet = WORLD.streetZs.find((sz) => sz > z - 8 && sz < z + width + 8);
    if (nextStreet !== undefined && z < nextStreet + WORLD.streetWidth / 2 + 3) { z = nextStreet + WORLD.streetWidth / 2 + 4; continue; }
    const floors = 4 + Math.floor(rng() * 5);
    const height = floors * 3.4 + 1.2;
    const x0 = WORLD.boulevardHalfWidth + 7;
    const cx = x0 + depth / 2;
    const cz = z + width / 2;
    const ci = Math.floor(rng() * PASTELS.length);
    const wall = new THREE.BoxGeometry(depth, height, width);
    scaleBoxUVs(wall, depth, height, width, 3.6, 3.4);
    wallGroups[ci].push(placed(wall, cx, height / 2, cz));
    colliders.push({ minX: x0, maxX: x0 + depth, minZ: z, maxZ: z + width });
    // Eyebrow ledges over every floor on the street front, and a stepped crown.
    for (let f = 1; f < floors; f += 1) trims.push(placed(new THREE.BoxGeometry(1.1, 0.22, width + 0.4), x0 - 0.4, f * 3.4 + 0.2, cz));
    trims.push(placed(new THREE.BoxGeometry(depth * 0.6, 2.4, width * 0.5), cx + 2, height + 1.2, cz));
    trims.push(placed(new THREE.BoxGeometry(depth + 0.6, 0.5, width + 0.6), cx, height + 0.25, cz));
    // Rounded corner tower in the facade colour.
    if (rng() < 0.6) {
      const corner = new THREE.CylinderGeometry(3, 3, height + 2, 16, 1);
      const cuv = corner.attributes.uv;
      for (let i = 0; i < cuv.count; i += 1) cuv.setXY(i, cuv.getX(i) * 5, cuv.getY(i) * floors);
      wallGroups[ci].push(placed(corner, x0 + 1.5, (height + 2) / 2, z + 2));
    }
    // Vertical fin carrying a neon sign facing the boulevard.
    const [label, color] = NEON_NAMES[neonIndex % NEON_NAMES.length];
    neonIndex += 1;
    const finH = Math.min(height - 3, 12);
    trims.push(placed(new THREE.BoxGeometry(1.4, finH + 1, 0.5), x0 - 0.9, height - finH / 2, cz));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(finH, finH / 4.5), new THREE.MeshBasicMaterial({ map: makeNeonTexture(label, color), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
    sign.position.set(x0 - 1.7, height - finH / 2, cz);
    sign.rotation.set(0, -Math.PI / 2, Math.PI / 2);
    sign.userData.baseColor = color;
    scene.add(sign);
    signMeshes.push(sign);
    // Awning over the ground floor.
    const awnColor = rng.pick([0xff4a3d, 0x2fd3c6, 0xffc23a, 0xff6f91, 0x4f8bff]);
    props.push(placed(tinted(new THREE.BoxGeometry(2.4, 0.15, width * 0.7), awnColor), x0 - 1.1, 3.2, cz, 0, 0, -0.25));
    roofs.push(placed(new THREE.BoxGeometry(2.2, 1.6, 2.2), cx + 4, height + 0.8 + 2.4, cz + width * 0.25));
    z += width + 2 + rng() * 4;
  }

  // Inland blocks: mid-rise pastels, with glass towers rising in Solar Centro.
  const xs = [WORLD.boulevardHalfWidth + 6, ...WORLD.avenueXs.flatMap((ax) => [ax - WORLD.avenueWidth / 2 - 4, ax + WORLD.avenueWidth / 2 + 4]), WORLD.cityMaxX + 30];
  const lanes = [];
  for (let i = 0; i < xs.length - 1; i += 2) lanes.push([xs[i] + (i === 0 ? 40 : 0), xs[i + 1]]);
  const zs = [WORLD.minZ, ...WORLD.streetZs, WORLD.maxZ];
  for (const [bx0, bx1] of lanes) {
    for (let k = 0; k < zs.length - 1; k += 1) {
      const bz0 = zs[k] + (k === 0 ? 0 : WORLD.streetWidth / 2 + 4);
      const bz1 = zs[k + 1] - WORLD.streetWidth / 2 - 4;
      const downtown = bx0 > 100 && bx0 < 240 && bz0 > -260 && bz1 < 260;
      const cols = bx1 - bx0 > 60 ? 2 : 1;
      const rows = 2 + Math.floor(rng() * 2);
      const cw = (bx1 - bx0) / cols;
      const rh = (bz1 - bz0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (bx0 < 40 && bz0 > 30 && bz0 < 100 && c === 0) continue;
          const w = cw - 3 - rng() * 4;
          const d = rh - 3 - rng() * 4;
          const floors = downtown ? 10 + Math.floor(rng() * 18) : 3 + Math.floor(rng() * 6);
          const h = floors * 3.4;
          const x = bx0 + c * cw + cw / 2;
          const zc = bz0 + r * rh + rh / 2;
          const geo = new THREE.BoxGeometry(w, h, d);
          scaleBoxUVs(geo, w, h, d, downtown ? 2.8 : 3.6, 3.4);
          placed(geo, x, h / 2, zc);
          if (downtown && rng() < 0.7) glassGroup.push(geo); else wallGroups[Math.floor(rng() * PASTELS.length)].push(geo);
          trims.push(placed(new THREE.BoxGeometry(w + 0.5, 0.45, d + 0.5), x, h + 0.2, zc));
          if (rng() < 0.5) roofs.push(placed(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 8), x + w * 0.2, h + 1.5, zc - d * 0.2));
          colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: zc - d / 2, maxZ: zc + d / 2 });
        }
      }
    }
  }

  // Far skyline beyond the north end and inland: hazy towers.
  const skylineParts = [];
  for (let i = 0; i < 60; i += 1) {
    const h = 30 + rng() * 110;
    const w = 14 + rng() * 22;
    const north = i < 36;
    const x = north ? rng.range(-10, 420) : rng.range(380, 520);
    const z = north ? rng.range(-760, -640) : rng.range(-600, 600);
    const geo = new THREE.BoxGeometry(w, h, w);
    scaleBoxUVs(geo, w, h, w, 3, 3.4);
    skylineParts.push(placed(geo, x, h / 2, z));
  }
  const skyline = new THREE.Mesh(mergeGeometries(skylineParts), new THREE.MeshStandardMaterial({ color: preset === 'night' ? 0x3a3f66 : 0xd6b8c8, map: facadeTex, emissiveMap: nightTex, emissive: preset === 'night' ? 0xffffff : 0x000000, emissiveIntensity: 0.6, roughness: 0.6 }));
  scene.add(skyline);

  // Streetlamps along both sides of Ocean Drive: one merged pole mesh and one glowing head mesh.
  const lampPoles = [];
  const lampHeads = [];
  for (let z = WORLD.minZ; z < WORLD.maxZ; z += 26) {
    for (const side of [-1, 1]) {
      const x = side * (WORLD.boulevardHalfWidth + 0.9);
      lampPoles.push(placed(new THREE.CylinderGeometry(0.09, 0.13, 7.5, 6), x, 3.75, z));
      lampPoles.push(placed(new THREE.BoxGeometry(2.2, 0.12, 0.12), x - side * 1.0, 7.4, z));
      lampHeads.push(placed(new THREE.BoxGeometry(0.8, 0.18, 0.4), x - side * 2.0, 7.3, z));
    }
  }
  const poleMesh = new THREE.Mesh(mergeGeometries(lampPoles), new THREE.MeshStandardMaterial({ color: 0x2d3340, roughness: 0.5, metalness: 0.6 }));
  poleMesh.castShadow = true;
  scene.add(poleMesh);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, toneMapped: false });
  scene.add(new THREE.Mesh(mergeGeometries(lampHeads), lampMat));

  // Traffic lights and palm planters at the boulevard junctions.
  for (const sz of WORLD.streetZs) {
    for (const side of [-1, 1]) {
      const x = side * (WORLD.boulevardHalfWidth + 1.2);
      props.push(placed(tinted(new THREE.CylinderGeometry(0.1, 0.1, 6, 6), 0x2d3340), x, 3, sz - side * 9));
      props.push(placed(tinted(new THREE.BoxGeometry(4.5, 0.18, 0.18), 0x2d3340), x - side * 2.2, 5.9, sz - side * 9));
      props.push(placed(tinted(new THREE.BoxGeometry(0.5, 1.4, 0.45), 0x1b1f28), x - side * 4.2, 5.4, sz - side * 9));
    }
  }

  // Neon Mercado: a boardwalk market over the sand in the north-east of the coast.
  const market = buildMarketBoardwalk(scene, rng, props, colliders);
  for (const s of market.signs) signMeshes.push(s);

  // Merge and add the static city meshes.
  wallGroups.forEach((list, i) => {
    if (!list.length) return;
    const m = new THREE.Mesh(mergeGeometries(list), pastelMats[i]);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  });
  if (glassGroup.length) {
    const g = new THREE.Mesh(mergeGeometries(glassGroup), glassMat);
    g.castShadow = true;
    g.receiveShadow = true;
    scene.add(g);
  }
  const trimMesh = new THREE.Mesh(mergeGeometries(trims), trimMat);
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  scene.add(trimMesh);
  const roofMesh = new THREE.Mesh(mergeGeometries(roofs), roofMat);
  roofMesh.castShadow = true;
  scene.add(roofMesh);
  const propMesh = new THREE.Mesh(mergeGeometries(props), vcolMat);
  propMesh.castShadow = true;
  propMesh.receiveShadow = true;
  scene.add(propMesh);

  // Lights (configured by the preset).
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  scene.add(fill);
  const pointPool = [];
  for (let i = 0; i < 6; i += 1) {
    const pl = new THREE.PointLight(0xffffff, 0, 30, 1.6);
    scene.add(pl);
    pointPool.push(pl);
  }

  const world = {
    scene,
    colliders,
    preset,
    sun,
    hemi,
    fill,
    pointPool,
    neonSigns: signMeshes,
    pastelMats,
    glassMat,
    lampMat,
    skyline,
    market,
    focus: new THREE.Vector3(),
    /** Keep the sun's shadow box centred on a point (the player). */
    setFocus(x, z) {
      this.focus.set(x, 0, z);
      const d = SKY_PRESETS[this.preset].sunDir;
      // The shadow-casting sun sits a little higher than the visible sun so shadows stay readable.
      sun.position.set(x + d[0] * 160, 160 * Math.max(d[1] * 3, 0.5), z + d[2] * 160);
      sun.target.position.set(x, 0, z);
    },
    update(t, dt) { for (const fn of animated) fn(t, dt); },
    animated,
  };
  scene.traverse((o) => { if (o.material?.uniforms?.time) animated.push((t) => { o.material.uniforms.time.value = t; }); });
  applyLightingPreset(world, preset);
  return world;
}

/** The Neon Mercado boardwalk: plank deck, striped stalls, crates for cover, string lights, lanterns and neon. */
function buildMarketBoardwalk(scene, rng, props, colliders) {
  const z0 = 150;
  const z1 = 420;
  const x0 = -62;
  const x1 = WORLD.beachInnerX - 0.5;
  const plank = makePlankTexture();
  plank.repeat.set((x1 - x0) / 8, (z1 - z0) / 8);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.5, z1 - z0), new THREE.MeshStandardMaterial({ map: plank, roughness: 0.7 }));
  deck.position.set((x0 + x1) / 2, 0.35, (z0 + z1) / 2);
  deck.receiveShadow = true;
  scene.add(deck);
  const stallColors = [[0xff4fb8, 0xffffff], [0x46e0ff, 0x1b2a4a], [0xffcf4a, 0xff4a3d], [0x7dff9b, 0x1b2a4a], [0xc08bff, 0xffffff]];
  const signs = [];
  const lanternParts = [];
  const bulbParts = [];
  const crates = [];
  const stallNames = [['TACOS LUNA', '#ffcf4a'], ['CEVICHE 24H', '#46e0ff'], ['MERCADO NEÓN', '#ff4fb8'], ['MARISCOS', '#7dff9b'], ['JUGOS', '#ff7a59'], ['CHURROS', '#c08bff']];
  let si = 0;
  for (let z = z0 + 8; z < z1 - 8; z += 14) {
    for (const x of [x0 + 7, x1 - 8]) {
      const [a, b] = stallColors[si % stallColors.length];
      const facing = x < (x0 + x1) / 2 ? 1 : -1;
      // Counter, posts and a striped canopy.
      props.push(placed(tinted(new THREE.BoxGeometry(3.2, 1.1, 5), 0x5a3a26), x, 1.15, z));
      props.push(placed(tinted(new THREE.BoxGeometry(3.4, 0.12, 5.2), 0xd9c3a0), x, 1.75, z));
      for (const [px, pz] of [[-1.5, -2.4], [1.5, -2.4], [-1.5, 2.4], [1.5, 2.4]]) props.push(placed(tinted(new THREE.BoxGeometry(0.12, 2.8, 0.12), 0x2a2a33), x + px, 2, z + pz));
      for (let s = 0; s < 6; s += 1) props.push(placed(tinted(new THREE.BoxGeometry(3.8, 0.12, 0.9), s % 2 ? a : b), x, 3.5, z - 2.25 + s * 0.9, 0, 0, facing * 0.22));
      const [label, color] = stallNames[si % stallNames.length];
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: makeNeonTexture(label, color), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
      sign.position.set(x + facing * 1.95, 4.3, z);
      sign.rotation.y = facing * Math.PI / 2;
      sign.userData.baseColor = color;
      scene.add(sign);
      signs.push(sign);
      colliders.push({ minX: x - 1.7, maxX: x + 1.7, minZ: z - 2.6, maxZ: z + 2.6 });
      // Crates and barrels in the aisle: cover for shootouts.
      if (rng() < 0.7) crates.push(placed(tinted(new THREE.BoxGeometry(1.2, 1.2, 1.2), 0x8a6a48), x + facing * 3.6, 1.2, z + 3.5, rng() * 0.5));
      if (rng() < 0.5) crates.push(placed(tinted(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10), 0x2f6bff), x + facing * 3.2, 1.2, z - 3.6));
      si += 1;
    }
    // String lights zig-zagging across the aisle, with paper lanterns.
    const lanternColors = [0xff4fb8, 0x46e0ff, 0xffcf4a, 0xff7a59];
    for (let k = 0; k <= 16; k += 1) {
      const t = k / 16;
      const x = x0 + 9 + t * (x1 - x0 - 18);
      const sag = Math.sin(t * Math.PI) * 1.1;
      bulbParts.push(placed(tinted(new THREE.SphereGeometry(0.12, 6, 4), k % 2 ? 0xfff0b0 : 0xff9ad5), x, 5.6 - sag, z + 7));
      if (k % 4 === 2) lanternParts.push(placed(tinted(new THREE.SphereGeometry(0.3, 10, 8), lanternColors[(k + si) % 4]), x, 5.0 - sag, z + 7));
    }
  }
  for (const c of crates) props.push(c);
  const bulbMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const bulbs = new THREE.Mesh(mergeGeometries(bulbParts), bulbMat);
  const lanterns = new THREE.Mesh(mergeGeometries(lanternParts), bulbMat);
  scene.add(bulbs, lanterns);
  // Mercado entrance arch.
  props.push(placed(tinted(new THREE.BoxGeometry(0.6, 7, 0.6), 0x1b2a4a), x0 + 2, 3.5, z0 + 1));
  props.push(placed(tinted(new THREE.BoxGeometry(0.6, 7, 0.6), 0x1b2a4a), x1 - 2, 3.5, z0 + 1));
  props.push(placed(tinted(new THREE.BoxGeometry(x1 - x0 - 3, 1.4, 0.5), 0x1b2a4a), (x0 + x1) / 2, 7, z0 + 1));
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.4), new THREE.MeshBasicMaterial({ map: makeNeonTexture('NEON MERCADO', '#ff4fd8', { w: 1024, h: 128, font: 'bold 92px "Nimbus Sans Narrow", sans-serif' }), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  arch.position.set((x0 + x1) / 2, 7.1, z0 + 1.3);
  arch.rotation.y = Math.PI;
  scene.add(arch);
  signs.push(arch);
  return { signs, bulbs, lanterns, bounds: { x0, x1, z0, z1 } };
}

/** Lighting presets: 'golden' (sunset over the ocean), 'night' (neon and moonlight). */
export function applyLightingPreset(world, preset) {
  const { scene, sun, hemi, fill } = world;
  world.preset = preset;
  const night = preset === 'night';
  if (night) {
    scene.fog = new THREE.Fog(0x24124a, 60, 520);
    hemi.color.set(0x6f6cff); hemi.groundColor.set(0x2a1838); hemi.intensity = 0.55;
    sun.color.set(0x9fb6ff); sun.intensity = 0.45;
    fill.color.set(0xff4fd8); fill.intensity = 0.35; fill.position.set(-40, 20, 60);
    for (const m of world.pastelMats) { m.emissive.set(0xffffff); m.emissiveIntensity = 0.75; }
    world.glassMat.emissive.set(0xffffff); world.glassMat.emissiveIntensity = 0.9;
    world.lampMat.color.set(0xffe2a6);
  } else {
    scene.fog = new THREE.Fog(0xf2b98a, 140, 900);
    hemi.color.set(0xffe8d0); hemi.groundColor.set(0x8a6a7a); hemi.intensity = 1.05;
    sun.color.set(0xffc58a); sun.intensity = 2.9;
    fill.color.set(0xff9ab8); fill.intensity = 0.55; fill.position.set(30, 18, 80);
    for (const m of world.pastelMats) { m.emissive.set(0x000000); m.emissiveIntensity = 0; }
    world.glassMat.emissive.set(0x000000);
    world.lampMat.color.set(0xfff6dd);
  }
  world.setFocus(world.focus.x, world.focus.z);
}

/** A prefiltered environment map of the preset's sky, for reflections on paint, glass and road. */
export function createEnvironmentMap(renderer, preset) {
  const envScene = new THREE.Scene();
  envScene.add(createSky(preset));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: preset === 'night' ? 0x120a24 : 0x6a5a5a }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -20;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0.03, 0.1, 4000);
  pmrem.dispose();
  return target.texture;
}

/** Collide a circle (x, z, radius) against the building footprints; returns the push-out vector or null. */
export function resolveBuildingCollision(world, x, z, radius) {
  for (const c of world.colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.0001;
      if (d2 === 0) {
        // Centre inside the box: push out along the shallowest axis.
        const pushes = [[c.minX - radius - x, 0], [c.maxX + radius - x, 0], [0, c.minZ - radius - z], [0, c.maxZ + radius - z]];
        pushes.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        return { x: pushes[0][0], z: pushes[0][1] };
      }
      return { x: (dx / d) * (radius - d), z: (dz / d) * (radius - d) };
    }
  }
  return null;
}
