// Vehicles of Palma Sol: sculpted multi-part models built from extruded side profiles whose width
// is reshaped into contoured fenders and a tapered greenhouse (the Solara GT sports car, PSPD
// cruisers with lightbars and pushbars, civilian sedans and the Palma Cab, a Vespina scooter and
// the Air-1 helicopter with its spotlight), the arcade driving model (grip, handbrake drift,
// nitro, damage), civilian traffic, and the sprite particle system behind fire, smoke,
// explosions, muzzle flashes and tyre smoke.
import * as THREE from 'three';
import { DRIVING, VEHICLES, TRAFFIC_COLORS, WORLD } from './config.js';
import { canvasTexture, makeGlowTexture, resolveBuildingCollision } from './world.js';
import { buildHumanoid } from './player.js';

const glowCache = {};
/** A cached radial glow texture for a colour. */
export function glowTexture(color = '#ffffff') {
  if (!glowCache[color]) {
    const c = new THREE.Color(color);
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    glowCache[color] = makeGlowTexture(`rgba(${rgb},1)`, `rgba(${rgb},0)`);
  }
  return glowCache[color];
}

/** An additive glowing sprite (lamp halos, lightbar flares, muzzle flashes). */
export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(color), color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.set(size, size, 1);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Body shaping

/**
 * Extrude a side profile (x forward, y up) to a width and turn it so the nose points −Z.
 * shapeWidth(x, y) returns the half-width factor used to sculpt fenders and tumblehome.
 */
function sculptedExtrude(points, width, bevel, shapeWidth, arches = []) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    if (p.arch) {
      const a = arches[p.arch - 1];
      shape.lineTo(a.cx - a.r, p[1]);
      shape.absarc(a.cx, a.cy, a.r, Math.PI, 0, true);
      shape.lineTo(a.cx + a.r, p[1]);
    } else shape.lineTo(p[0], p[1]);
  }
  shape.closePath();
  const depth = Math.max(0.05, width - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 4, curveSegments: 14, steps: 3 });
  geo.translate(0, 0, -depth / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) * shapeWidth(x, y));
  }
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Wheel-arch flare and tumblehome profile for a body of the given wheel positions. */
function fenderWidth(wheelXs, top, noseX, tailX) {
  return (x, y) => {
    let f = 1;
    for (const wx of wheelXs) {
      const d = Math.abs(x - wx);
      if (d < 0.75 && y > 0.25 && y < 0.95) f += 0.07 * Math.cos((d / 0.75) * Math.PI * 0.5) * Math.sin(((y - 0.25) / 0.7) * Math.PI);
    }
    f -= Math.max(0, (y - (top - 0.25)) / 0.25) * 0.09;
    if (x > noseX - 0.6) f -= ((x - (noseX - 0.6)) / 0.6) * 0.1;
    if (x < tailX + 0.3) f -= ((tailX + 0.3 - x) / 0.3) * 0.04;
    return f;
  };
}

let carbonTexture = null;
function getCarbonTexture() {
  if (!carbonTexture) {
    carbonTexture = canvasTexture(64, 64, (ctx) => {
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? '#1b1d22' : '#2c3038';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }, { repeat: true });
    carbonTexture.repeat.set(6, 2);
  }
  return carbonTexture;
}

const rimTextures = {};
function rimTexture(spinning) {
  const key = spinning ? 'spin' : 'still';
  if (!rimTextures[key]) {
    rimTextures[key] = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#20232a';
      ctx.fillRect(0, 0, 128, 128);
      const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
      g.addColorStop(0, '#f2f4f8');
      g.addColorStop(0.7, '#9aa3b2');
      g.addColorStop(1, '#3a404c');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
      if (spinning) {
        ctx.fillStyle = 'rgba(30,34,42,0.55)';
        ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.arc(64, 64, 18, 0, Math.PI * 2, true); ctx.fill();
        ctx.strokeStyle = 'rgba(230,236,245,0.35)';
        ctx.lineWidth = 2;
        for (let r = 22; r < 52; r += 6) { ctx.beginPath(); ctx.arc(64, 64, r, 0, Math.PI * 2); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#1c1f26';
        for (let i = 0; i < 5; i += 1) {
          ctx.save(); ctx.translate(64, 64); ctx.rotate((i / 5) * Math.PI * 2);
          ctx.beginPath(); ctx.moveTo(-9, 18); ctx.lineTo(-14, 52); ctx.lineTo(14, 52); ctx.lineTo(9, 18); ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = '#ff3b2f';
      ctx.beginPath(); ctx.arc(64, 64, 9, 0, Math.PI * 2); ctx.fill();
    });
  }
  return rimTextures[key];
}

/** A wheel: tyre, sidewall, alloy rim face and brake caliper, inside a pivot for steering. */
function buildWheel(radius, width, side, spinning) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24, 1), new THREE.MeshStandardMaterial({ color: 0x16171b, roughness: 0.9 }));
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  spin.add(tyre);
  const rim = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.74, 24), new THREE.MeshStandardMaterial({ map: rimTexture(spinning), metalness: 0.85, roughness: 0.25 }));
  rim.position.x = side * (width / 2 + 0.005);
  rim.rotation.y = side * Math.PI / 2;
  spin.add(rim);
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.22), new THREE.MeshStandardMaterial({ color: 0xffb02e, roughness: 0.4 }));
  caliper.position.set(side * (width / 2 - 0.04), radius * 0.38, -radius * 0.25);
  pivot.add(caliper);
  pivot.userData.spin = spin;
  return pivot;
}

function paintMaterial(color, { metal = 0.55, rough = 0.26 } = {}) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: metal, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });
}
const glassMaterial = () => new THREE.MeshPhysicalMaterial({ color: 0x0d1620, metalness: 0.4, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6 });
const trimMaterial = () => new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.5, metalness: 0.3 });

function addLamp(group, w, h, d, color, x, y, z, glowSize = 0) {
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  lamp.position.set(x, y, z);
  group.add(lamp);
  if (glowSize) {
    const g = glowSprite(`#${new THREE.Color(color).getHexString()}`, glowSize, 0.8);
    g.position.set(x, y, z + Math.sign(z) * 0.1);
    group.add(g);
    lamp.userData.glow = g;
  }
  return lamp;
}

// ---------------------------------------------------------------------------------------------
// Builders

/**
 * The Solara GT: a low mid-engine sports coupé with contoured fenders, a carbon spoiler, a full
 * width light bar, quad exhausts and twin cyan nitro flames. Nose points −Z.
 */
export function buildSportsCar({ color = VEHICLES.solara.color, spinning = false, nitro = false } = {}) {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);
  const paint = paintMaterial(color);
  const arches = [{ cx: -1.42, cy: 0.36, r: 0.47 }, { cx: 1.4, cy: 0.36, r: 0.47 }];
  const lower = [[-2.3, 0.34], [-2.12, 0.2], [0, 0.2, 1], [0.5, 0.2], [0, 0.2, 2], [2.12, 0.22], [2.34, 0.36], [2.36, 0.5], [2.2, 0.62], [1.5, 0.76], [0.72, 0.88], [-0.4, 0.93], [-1.3, 0.95], [-1.95, 0.98], [-2.3, 0.94], [-2.36, 0.62]];
  const lowerPts = lower.map((p) => { const q = [p[0], p[1]]; if (p[2]) q.arch = p[2]; return q; });
  const shell = new THREE.Mesh(sculptedExtrude(lowerPts, 1.96, 0.13, fenderWidth([-1.42, 1.4], 0.98, 2.36, -2.36), arches), paint);
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);
  const cabinPts = [[0.86, 0.86], [0.02, 1.26], [-0.7, 1.29], [-1.25, 1.17], [-1.85, 0.97], [-1.2, 0.9], [0.2, 0.86]];
  const cabin = new THREE.Mesh(sculptedExtrude(cabinPts, 1.5, 0.1, (x, y) => 1 - Math.max(0, y - 0.9) * 0.28), glassMaterial());
  cabin.castShadow = true;
  body.add(cabin);
  const roofPts = [[0.0, 1.25], [-0.72, 1.31], [-1.24, 1.19], [-1.18, 1.15], [-0.7, 1.25], [0.02, 1.21]];
  const roof = new THREE.Mesh(sculptedExtrude(roofPts, 1.38, 0.05, () => 1), paint);
  roof.position.y = 0.02;
  body.add(roof);
  const trim = trimMaterial();
  // Side skirts, rear diffuser with fins, front splitter, side intakes, mirrors.
  for (const s of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 2.0), trim);
    skirt.position.set(s * 0.97, 0.27, 0);
    body.add(skirt);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.6), trim);
    intake.position.set(s * 1.0, 0.62, 0.55);
    intake.rotation.x = -0.25;
    body.add(intake);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.16), paint);
    mirror.position.set(s * 0.86, 0.98, -0.62);
    body.add(mirror);
  }
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.3), new THREE.MeshStandardMaterial({ map: getCarbonTexture(), roughness: 0.35, metalness: 0.3 }));
  diffuser.position.set(0, 0.28, 2.28);
  body.add(diffuser);
  for (let i = -3; i <= 3; i += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.3), trim);
    fin.position.set(i * 0.2, 0.28, 2.36);
    body.add(fin);
  }
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.3), new THREE.MeshStandardMaterial({ map: getCarbonTexture(), roughness: 0.35 }));
  splitter.position.set(0, 0.2, -2.3);
  body.add(splitter);
  // Carbon rear wing on swan-neck struts.
  const carbon = new THREE.MeshStandardMaterial({ map: getCarbonTexture(), roughness: 0.3, metalness: 0.4 });
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.05, 0.4), carbon);
  wing.position.set(0, 1.24, 2.0);
  wing.rotation.x = -0.08;
  wing.castShadow = true;
  body.add(wing);
  for (const s of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.44), carbon);
    plate.position.set(s * 0.98, 1.22, 2.0);
    body.add(plate);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.1), carbon);
    strut.position.set(s * 0.5, 1.07, 2.04);
    body.add(strut);
  }
  // Lights: full-width tail bar with two hex lamps, LED headlight strips, plate.
  const tail = addLamp(body, 1.5, 0.05, 0.04, 0xff1f3a, 0, 0.8, 2.355, 0);
  const tails = [tail];
  for (const s of [-1, 1]) {
    tails.push(addLamp(body, 0.34, 0.11, 0.05, 0xff2340, s * 0.66, 0.77, 2.34, 1.1));
    addLamp(body, 0.4, 0.05, 0.05, 0xf4fbff, s * 0.62, 0.55, -2.33, 0.9);
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshBasicMaterial({ map: plateTexture('SOL·GT3'), toneMapped: false }));
  plate.position.set(0, 0.5, 2.37);
  body.add(plate);
  // Quad exhausts and nitro flames.
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dee8, metalness: 1, roughness: 0.15 });
  const flames = [];
  for (const s of [-1, 1]) {
    for (const o of [0.36, 0.52]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 10), chrome);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(s * o, 0.33, 2.38);
      body.add(pipe);
    }
    const flame = buildNitroFlame();
    flame.position.set(s * 0.44, 0.33, 2.48);
    flame.visible = nitro;
    body.add(flame);
    flames.push(flame);
  }
  const wheels = addWheels(car, [[-0.86, 0.36, -1.4, true], [0.86, 0.36, -1.4, true], [-0.88, 0.36, 1.42, false], [0.88, 0.36, 1.42, false]], 0.36, 0.3, spinning);
  car.userData = { kind: 'sports', body, wheels, flames, tails, paint, length: 4.7, width: 2.0 };
  return car;
}

function plateTexture(text) {
  return canvasTexture(128, 32, (ctx) => {
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(0, 0, 128, 32);
    ctx.strokeStyle = '#1d3b7a';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 124, 28);
    ctx.fillStyle = '#1d3b7a';
    ctx.font = 'bold 20px "Nimbus Sans Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 64, 24);
  });
}

/** Twin-layer cyan nitro flame: an outer additive cone, a white-hot core and a glow. */
function buildNitroFlame() {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.3, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x29d8ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.z = 0.6;
  g.add(outer);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.7, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  core.rotation.x = -Math.PI / 2;
  core.position.z = 0.32;
  g.add(core);
  const glow = glowSprite('#3fdcff', 1.3, 0.9);
  glow.position.z = 0.15;
  g.add(glow);
  return g;
}

function addWheels(car, spec, radius, width, spinning) {
  const wheels = [];
  for (const [x, y, z, front] of spec) {
    const w = buildWheel(radius, width, Math.sign(x), spinning);
    w.position.set(x, y, z);
    w.userData.front = front;
    car.add(w);
    wheels.push(w);
  }
  return wheels;
}

let pspdTex = null;
function pspdDecal() {
  if (!pspdTex) {
    pspdTex = canvasTexture(256, 64, (ctx) => {
      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = '#1d3b7a';
      ctx.font = 'bold 44px "Nimbus Sans Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PSPD', 92, 46);
      ctx.fillStyle = '#ffc93a';
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 9 : 20;
        ctx.lineTo(200 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      }
      ctx.fill();
    });
  }
  return pspdTex;
}

/**
 * A four-door sedan body used by PSPD cruisers, civilian traffic and the Palma Cab.
 * options.livery: 'police' | 'cab' | null
 */
export function buildSedan({ color = 0x58d6c9, livery = null, spinning = false, officer = false } = {}) {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);
  const police = livery === 'police';
  const paint = paintMaterial(police ? 0xf6f7fb : color, { metal: police ? 0.2 : 0.45, rough: 0.32 });
  const arches = [{ cx: -1.5, cy: 0.38, r: 0.48 }, { cx: 1.45, cy: 0.38, r: 0.48 }];
  const lower = [[-2.42, 0.4], [-2.25, 0.24], [0, 0.24, 1], [0.4, 0.24], [0, 0.24, 2], [2.25, 0.26], [2.46, 0.42], [2.46, 0.72], [2.25, 0.84], [1.0, 0.92], [-1.5, 0.98], [-2.4, 0.98], [-2.46, 0.7]];
  const lowerPts = lower.map((p) => { const q = [p[0], p[1]]; if (p[2]) q.arch = p[2]; return q; });
  const shell = new THREE.Mesh(sculptedExtrude(lowerPts, 1.9, 0.12, fenderWidth([-1.5, 1.45], 0.98, 2.46, -2.46), arches), paint);
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);
  const cabinPts = [[0.95, 0.9], [0.25, 1.42], [-1.05, 1.44], [-1.65, 0.98], [0.2, 0.92]];
  const cabin = new THREE.Mesh(sculptedExtrude(cabinPts, 1.62, 0.1, (x, y) => 1 - Math.max(0, y - 0.95) * 0.22), glassMaterial());
  cabin.castShadow = true;
  body.add(cabin);
  const roofPts = [[0.22, 1.43], [-1.02, 1.45], [-1.02, 1.4], [0.22, 1.38]];
  const roof = new THREE.Mesh(sculptedExtrude(roofPts, 1.52, 0.05, () => 1), police ? paintMaterial(0x15233f, { metal: 0.3, rough: 0.4 }) : paint);
  roof.position.y = 0.02;
  body.add(roof);
  const trim = trimMaterial();
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.2, 0.18), trim);
  bumperR.position.set(0, 0.38, 2.44);
  body.add(bumperR);
  const bumperF = bumperR.clone();
  bumperF.position.z = -2.44;
  body.add(bumperF);
  const tails = [];
  for (const s of [-1, 1]) {
    tails.push(addLamp(body, 0.42, 0.14, 0.05, 0xff2340, s * 0.66, 0.78, 2.47, 0.9));
    addLamp(body, 0.38, 0.12, 0.05, 0xf4fbff, s * 0.62, 0.68, -2.47, 0.8);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.14), trim);
    mirror.position.set(s * 0.9, 1.0, -0.75);
    body.add(mirror);
  }
  const userData = { kind: police ? 'police' : 'sedan', body, tails, paint, length: 4.95, width: 1.95 };
  if (police) {
    // Livery: blue stripe, black doors band, PSPD decals, pushbar and a lightbar.
    const blue = new THREE.MeshStandardMaterial({ color: 0x1d3b7a, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 2.6), new THREE.MeshStandardMaterial({ color: 0x0f1626, roughness: 0.4 }));
      band.position.set(s * 0.985, 0.58, -0.1);
      body.add(band);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 4.4), blue);
      stripe.position.set(s * 0.99, 0.82, 0);
      body.add(stripe);
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.28), new THREE.MeshBasicMaterial({ map: pspdDecal(), transparent: true }));
      decal.position.set(s * 1.0, 0.6, -0.15);
      decal.rotation.y = s * Math.PI / 2;
      body.add(decal);
    }
    const trunkDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: pspdDecal(), transparent: true }));
    trunkDecal.position.set(0, 0.99, 2.0);
    trunkDecal.rotation.x = -Math.PI / 2;
    body.add(trunkDecal);
    const bar = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.5, metalness: 0.5 });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), frame);
      post.position.set(s * 0.45, 0.55, -2.68);
      bar.add(post);
    }
    for (const y of [0.4, 0.72]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), frame);
      rail.position.set(0, y, -2.7);
      bar.add(rail);
    }
    body.add(bar);
    userData.lightbar = buildLightbar(body);
    if (officer) userData.officer = addLeaningOfficer(body, officer === true ? -1 : Math.sign(officer));
  }
  if (livery === 'cab') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.3), new THREE.MeshBasicMaterial({ map: plateTexture('PALMA CAB'), toneMapped: false }));
    sign.position.set(0, 1.62, -0.4);
    body.add(sign);
    const checker = canvasTexture(128, 16, (ctx) => { for (let i = 0; i < 16; i += 1) { ctx.fillStyle = i % 2 ? '#111' : '#fff'; ctx.fillRect(i * 8, 0, 8, 8); ctx.fillStyle = i % 2 ? '#fff' : '#111'; ctx.fillRect(i * 8, 8, 8, 8); } });
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.14), new THREE.MeshBasicMaterial({ map: checker }));
      strip.position.set(s * 0.99, 0.66, 0);
      strip.rotation.y = s * Math.PI / 2;
      body.add(strip);
    }
  }
  userData.wheels = addWheels(car, [[-0.86, 0.38, -1.45, true], [0.86, 0.38, -1.45, true], [-0.86, 0.38, 1.5, false], [0.86, 0.38, 1.5, false]], 0.38, 0.28, spinning);
  car.userData = userData;
  return car;
}

/** Roof lightbar: red and blue lenses with additive flares that strobe in updateLightbar. */
function buildLightbar(body) {
  const group = new THREE.Group();
  group.position.set(0, 1.5, -0.35);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.32), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4 }));
  group.add(base);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.28), new THREE.MeshBasicMaterial({ color: 0xff1e3c, toneMapped: false }));
  red.position.set(-0.33, 0.1, 0);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.28), new THREE.MeshBasicMaterial({ color: 0x1e5cff, toneMapped: false }));
  blue.position.set(0.33, 0.1, 0);
  group.add(red, blue);
  const redGlow = glowSprite('#ff2a4a', 3.6, 0.95);
  redGlow.position.set(-0.4, 0.15, 0);
  const blueGlow = glowSprite('#2a6bff', 3.6, 0.95);
  blueGlow.position.set(0.4, 0.15, 0);
  const redHalo = glowSprite('#ff2a4a', 9, 0.35);
  redHalo.position.set(-0.4, 0.15, 0);
  const blueHalo = glowSprite('#2a6bff', 9, 0.35);
  blueHalo.position.set(0.4, 0.15, 0);
  group.add(redGlow, blueGlow, redHalo, blueHalo);
  body.add(group);
  return { group, red, blue, redGlow, blueGlow, redHalo, blueHalo };
}

/** Strobe a cruiser's lightbar: alternating red/blue double flashes. */
export function updateLightbar(car, t) {
  const lb = car.userData.lightbar;
  if (!lb) return;
  const phase = (t * 2.2 + (car.userData.phase || 0)) % 1;
  const redOn = phase < 0.5 ? 1 : 0.25;
  const blueOn = phase >= 0.5 ? 1 : 0.25;
  lb.redGlow.material.opacity = 0.35 + 0.65 * redOn;
  lb.redHalo.material.opacity = 0.15 + 0.3 * redOn;
  lb.blueGlow.material.opacity = 0.35 + 0.65 * blueOn;
  lb.blueHalo.material.opacity = 0.15 + 0.3 * blueOn;
}

/** An officer leaning out of the passenger window, aiming a pistol, with a muzzle flash. */
function addLeaningOfficer(body, side = -1) {
  const cop = buildHumanoid({ skin: 0xd9a47e, shirt: 0x1d3b7a, pants: 0x0f1626, hair: 0x15171c, cap: 0x0f1626, scale: 0.95 });
  cop.position.set(side * 0.98, 0.25, 0.1);
  cop.rotation.z = -side * 0.5;
  cop.rotation.y = side * 0.35;
  const arm = cop.userData.rightArm;
  const off = cop.userData.leftArm;
  const aimArm = side > 0 ? arm : off;
  aimArm.rotation.set(-1.45, 0, side * 0.25);
  body.add(cop);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.32), new THREE.MeshStandardMaterial({ color: 0x15171c }));
  gun.position.set(side * 1.65, 1.62, -0.55);
  body.add(gun);
  const flash = glowSprite('#ffd27a', 1.5, 1);
  flash.position.set(side * 1.75, 1.66, -0.95);
  body.add(flash);
  const core = glowSprite('#ffffff', 0.6, 1);
  core.position.copy(flash.position);
  body.add(core);
  return { cop, gun, flash, core, side };
}

/** The Vespina scooter with a rider. */
export function buildScooter({ color = VEHICLES.scooter.color, rider = true } = {}) {
  const g = new THREE.Group();
  const paint = paintMaterial(color, { metal: 0.3, rough: 0.35 });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 1.2), paint);
  shell.position.set(0, 0.55, 0.15);
  g.add(shell);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a2418 }));
  seat.position.set(0, 0.84, 0.25);
  g.add(seat);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.15), paint);
  shield.position.set(0, 0.75, -0.5);
  shield.rotation.x = -0.25;
  g.add(shield);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), trimMaterial());
  bar.position.set(0, 1.2, -0.55);
  g.add(bar);
  const wheels = addWheels(g, [[0, 0.22, -0.65, true], [0, 0.22, 0.7, false]], 0.22, 0.14, false);
  addLamp(g, 0.18, 0.08, 0.05, 0xff2340, 0, 0.7, 0.78, 0.5);
  if (rider) {
    const r = buildHumanoid({ skin: 0xc98e62, shirt: 0xffc23a, pants: 0x2f3b52, hair: 0x22180f, helmet: 0xff6f91 });
    r.position.set(0, 0.42, 0.25);
    r.userData.sit?.();
    g.add(r);
  }
  g.userData = { kind: 'scooter', wheels, length: 1.8, width: 0.7 };
  return g;
}

let rotorTex = null;
/**
 * The Air-1 police helicopter: livery body, glass nose, skids, motion-blurred main and tail rotor
 * discs, and a searchlight with a visible light cone and a pool on the ground.
 */
export function buildHelicopter() {
  const heli = new THREE.Group();
  const navy = paintMaterial(0x14254a, { metal: 0.4, rough: 0.35 });
  const white = paintMaterial(0xf2f4f8, { metal: 0.2, rough: 0.35 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), navy);
  body.scale.set(1.25, 1.1, 2.3);
  body.castShadow = true;
  heli.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
  belly.scale.set(1.27, 1.12, 2.32);
  heli.add(belly);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMaterial());
  nose.scale.set(1.0, 0.9, 1.2);
  nose.rotation.x = -Math.PI / 2 + 0.3;
  nose.position.set(0, 0.15, -1.3);
  heli.add(nose);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 4.6, 10), navy);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.35, 3.8);
  heli.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.8), navy);
  fin.position.set(0, 1.0, 5.9);
  fin.rotation.x = -0.3;
  heli.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), white);
  stab.position.set(0, 0.45, 5.3);
  heli.add(stab);
  const skidMat = trimMaterial();
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), skidMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(s * 1.0, -1.35, 0);
    heli.add(skid);
    for (const z of [-0.8, 0.8]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), skidMat);
      strut.position.set(s * 0.85, -1.1, z);
      strut.rotation.z = s * 0.3;
      heli.add(strut);
    }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: plateTexture('AIR-1 PSPD'), transparent: true }));
    label.position.set(s * 1.27, -0.1, 0.4);
    label.rotation.y = s * Math.PI / 2;
    heli.add(label);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), skidMat);
  mast.position.y = 1.25;
  heli.add(mast);
  if (!rotorTex) {
    rotorTex = canvasTexture(256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
      g.addColorStop(0, 'rgba(20,24,32,0.5)');
      g.addColorStop(0.85, 'rgba(20,24,32,0.28)');
      g.addColorStop(1, 'rgba(20,24,32,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(128, 128, 128, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(230,236,245,0.18)';
      ctx.lineWidth = 3;
      for (let r = 40; r < 128; r += 22) { ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke(); }
    });
  }
  const rotor = new THREE.Group();
  rotor.position.y = 1.5;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 40), new THREE.MeshBasicMaterial({ map: rotorTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 5.4), skidMat);
    blade.position.z = 2.7;
    const arm = new THREE.Group();
    arm.rotation.y = (i / 4) * Math.PI * 2 + 0.3;
    arm.add(blade);
    rotor.add(arm);
  }
  heli.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), new THREE.MeshBasicMaterial({ map: rotorTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  tailRotor.rotation.y = Math.PI / 2;
  tailRotor.position.set(0.15, 1.1, 6.1);
  heli.add(tailRotor);
  const nav = addLamp(heli, 0.12, 0.12, 0.12, 0xff2a4a, 0, -0.9, 1.6, 1.4);
  const strobe = addLamp(heli, 0.12, 0.12, 0.12, 0xffffff, 0, 1.0, 6.3, 1.6);
  // Searchlight: a spot light, a visible cone and a pool on the road.
  const lightHead = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.4, 10), skidMat);
  lightHead.position.set(0, -1.15, -1.4);
  heli.add(lightHead);
  const spot = new THREE.SpotLight(0xf4f8ff, 900, 120, 0.2, 0.5, 1.3);
  spot.position.set(0, -1.2, -1.4);
  heli.add(spot);
  heli.add(spot.target);
  const cone = buildLightCone();
  heli.add(cone);
  heli.userData = { kind: 'helicopter', rotor, tailRotor, spot, cone, nav, strobe, lightHead };
  return heli;
}

/** A soft volumetric light cone mesh: additive, fading along its length and toward its edges. */
function buildLightCone() {
  const geo = new THREE.CylinderGeometry(0.25, 5.2, 1, 32, 8, true);
  geo.translate(0, -0.5, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(0xdbe8ff) }, strength: { value: 0.55 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vView;
      void main(){ vY = -position.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float strength; varying float vY; varying vec3 vN; varying vec3 vView;
      void main(){ float edge = pow(abs(dot(vN, vView)), 1.4); float fall = (1.0 - vY) * 0.85 + 0.15; gl_FragColor = vec4(color * edge * fall * strength, 1.0); }`,
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.renderOrder = 5;
  return cone;
}

/** Point the helicopter searchlight (cone, spot and pool) at a world position. */
export function aimSearchlight(heli, target, scene) {
  const ud = heli.userData;
  heli.updateMatrixWorld(true);
  const origin = new THREE.Vector3(0, -1.2, -1.4).applyMatrix4(heli.matrixWorld);
  const dir = target.clone().sub(origin);
  const len = dir.length();
  const local = heli.worldToLocal(target.clone());
  ud.spot.target.position.copy(local);
  const localOrigin = new THREE.Vector3(0, -1.2, -1.4);
  ud.cone.position.copy(localOrigin);
  const localDir = local.clone().sub(localOrigin).normalize();
  ud.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), localDir);
  ud.cone.scale.set(1, len, 1);
  if (!ud.pool && scene) {
    ud.pool = new THREE.Mesh(new THREE.CircleGeometry(5.6, 32), new THREE.MeshBasicMaterial({ map: glowTexture('#e8f0ff'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ud.pool.rotation.x = -Math.PI / 2;
    scene.add(ud.pool);
  }
  if (ud.pool) ud.pool.position.set(target.x, 0.08, target.z);
}

/** Spin rotors, blink nav lights. */
export function updateHelicopter(heli, t) {
  const ud = heli.userData;
  ud.rotor.rotation.y = t * 22;
  ud.tailRotor.rotation.x = t * 40;
  ud.strobe.visible = (t * 1.5) % 1 < 0.15;
}

// ---------------------------------------------------------------------------------------------
// Driving model

/** Create the physics state for a vehicle model of a class from VEHICLES. */
export function createVehicleState(model, classId, x, z, heading = 0) {
  const spec = VEHICLES[classId];
  return {
    model,
    classId,
    spec: { ...spec },
    x,
    z,
    heading,
    speed: 0,
    lateral: 0,
    steer: 0,
    yawRate: 0,
    nitro: 0.78,
    condition: 1,
    drifting: false,
    boosting: false,
    wrecked: false,
    radius: model.userData.length ? model.userData.length * 0.42 : 1.2,
    wheelSpin: 0,
  };
}

/**
 * Advance one vehicle by dt. input: { throttle: -1..1, steer: -1..1, handbrake, nitro }.
 * Returns an impact strength (m/s) when the car hit a building this step, else 0.
 */
export function updateVehiclePhysics(v, input, dt, world) {
  if (v.wrecked) { v.speed *= 0.9; return 0; }
  const top = (v.spec.topSpeed / 3.6) * (v.boosting ? 1.15 : 1);
  const accel = v.spec.accel;
  v.boosting = !!input.nitro && v.nitro > 0.02 && input.throttle > 0;
  if (v.boosting) v.nitro = Math.max(0, v.nitro - DRIVING.nitroDrainPerSec * dt);
  else v.nitro = Math.min(1, v.nitro + DRIVING.nitroRefillPerSec * dt);
  let force = 0;
  if (input.throttle > 0) force = accel * input.throttle * (v.boosting ? DRIVING.nitroBoost : 1);
  else if (input.throttle < 0) force = v.speed > 1 ? -DRIVING.brakeForce * -input.throttle : -accel * 0.55 * -input.throttle;
  force -= Math.sign(v.speed) * (DRIVING.rollingResistance + DRIVING.dragCoefficient * v.speed * v.speed * 9);
  v.speed += force * dt;
  if (input.handbrake) v.speed *= 1 - 0.9 * dt;
  v.speed = Math.max(-top * 0.3, Math.min(top, v.speed));
  if (Math.abs(v.speed) < 0.05 && input.throttle === 0) v.speed = 0;
  const steerTarget = input.steer * DRIVING.maxSteer * (1 - Math.min(0.55, Math.abs(v.speed) / 90));
  v.steer += (steerTarget - v.steer) * Math.min(1, DRIVING.steerRate * dt * 3);
  const wheelbase = 2.8;
  const grip = v.spec.grip * (input.handbrake ? DRIVING.handbrakeGripScale : 1);
  const targetYaw = (v.speed * Math.tan(v.steer)) / wheelbase;
  v.yawRate += (targetYaw * (input.handbrake ? 1.35 : 1) - v.yawRate) * Math.min(1, 8 * dt);
  v.heading += v.yawRate * dt;
  // Lateral slip builds when grip is low and the car is turning fast; it decays with grip.
  v.lateral += (-v.yawRate * v.speed * (1 - grip) * 0.35 - v.lateral * grip * 4) * dt;
  v.drifting = Math.abs(v.lateral) > 2.2;
  const fx = -Math.sin(v.heading);
  const fz = -Math.cos(v.heading);
  v.x += (fx * v.speed + fz * -v.lateral) * dt;
  v.z += (fz * v.speed - fx * -v.lateral) * dt;
  v.wheelSpin += (v.speed / 0.36) * dt;
  let impact = 0;
  if (world) {
    const push = resolveBuildingCollision(world, v.x, v.z, v.radius * 0.6);
    if (push) {
      v.x += push.x;
      v.z += push.z;
      impact = Math.abs(v.speed);
      v.speed *= -0.25;
      v.lateral *= 0.3;
      v.condition = Math.max(0, v.condition - impact * 0.004 * (1 - v.spec.armor * 0.6));
    }
    v.x = Math.max(WORLD.oceanEdgeX + 4, Math.min(WORLD.cityMaxX + 20, v.x));
    v.z = Math.max(WORLD.minZ + 5, Math.min(WORLD.maxZ - 5, v.z));
  }
  return impact;
}

/** Copy the physics state onto the model: position, heading, body roll and pitch, wheel spin and steer, flames. */
export function syncVehicleModel(v) {
  const m = v.model;
  m.position.set(v.x, 0, v.z);
  m.rotation.y = v.heading;
  const ud = m.userData;
  if (ud.body) {
    ud.body.rotation.z = THREE.MathUtils.clamp(-v.yawRate * v.speed * 0.004, -0.06, 0.06);
    ud.body.rotation.x = THREE.MathUtils.clamp(v.speed * 0.0006, -0.03, 0.03);
  }
  for (const w of ud.wheels || []) {
    w.userData.spin.rotation.x = -v.wheelSpin;
    if (w.userData.front) w.rotation.y = v.steer;
  }
  for (const f of ud.flames || []) {
    f.visible = v.boosting;
    f.scale.setScalar(0.9 + Math.random() * 0.2);
  }
  for (const t of ud.tails || []) if (t.userData.glow) t.userData.glow.scale.setScalar(v.speed < -0.1 || v.braking ? 1.6 : 1.1);
}

/** Wreck a vehicle: char its paint, stop it and return a burst position for an explosion. */
export function wreckVehicle(v) {
  v.wrecked = true;
  v.condition = 0;
  v.model.traverse((o) => {
    if (o.isMesh && o.material?.isMeshPhysicalMaterial) { o.material = o.material.clone(); o.material.color.set(0x1e1b1a); o.material.metalness = 0.1; o.material.roughness = 0.9; o.material.clearcoat = 0; }
  });
  if (v.model.userData.lightbar) v.model.userData.lightbar.group.visible = false;
  return new THREE.Vector3(v.x, 1, v.z);
}

// ---------------------------------------------------------------------------------------------
// Traffic

/** Spawn civilian cars driving both ways on Ocean Drive and the avenues. */
export function createTraffic(scene, rng, count = 18, { nearZ = 0, spread = 400 } = {}) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const roll = rng();
    const isCab = roll < 0.15;
    const isScooter = roll > 0.9;
    const model = isScooter ? buildScooter() : buildSedan({ color: isCab ? VEHICLES.cab.color : rng.pick(TRAFFIC_COLORS), livery: isCab ? 'cab' : null });
    const north = rng() < 0.5;
    const laneX = north ? rng.pick([2.8, 8.2]) : rng.pick([-2.8, -8.2]);
    const z = nearZ + rng.range(-spread, spread);
    const v = createVehicleState(model, isScooter ? 'scooter' : isCab ? 'cab' : 'coupe', laneX, z, north ? 0 : Math.PI);
    v.cruise = (isScooter ? 9 : 11 + rng() * 5);
    v.laneX = laneX;
    v.speed = v.cruise;
    syncVehicleModel(v);
    scene.add(model);
    cars.push(v);
  }
  return cars;
}

/** Drive traffic along its lane: keep cruise speed, hold the lane, brake behind anything ahead. */
export function updateTraffic(cars, obstacles, dt) {
  for (const v of cars) {
    if (v.wrecked || v.stolen) continue;
    const fx = -Math.sin(v.heading);
    const fz = -Math.cos(v.heading);
    let blocked = false;
    for (const o of obstacles) {
      if (o === v) continue;
      const dx = o.x - v.x;
      const dz = o.z - v.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 12 && side < 2.4) { blocked = true; break; }
    }
    const target = blocked ? 0 : v.cruise;
    v.speed += (target - v.speed) * Math.min(1, dt * (blocked ? 3 : 0.8));
    v.x += (v.laneX - v.x) * Math.min(1, dt * 1.5);
    v.z += fz * v.speed * dt;
    if (v.z < WORLD.minZ + 10) v.z = WORLD.maxZ - 10;
    if (v.z > WORLD.maxZ - 10) v.z = WORLD.minZ + 10;
    v.wheelSpin += (v.speed / 0.36) * dt;
    syncVehicleModel(v);
  }
}

// ---------------------------------------------------------------------------------------------
// Particles

/**
 * Sprite particle system for fire, smoke, sparks, debris glow, tyre smoke and explosion bursts.
 * Deterministic when given a seeded rng.
 */
export class ParticleSystem {
  constructor(scene, rng = Math.random, max = 420) {
    this.scene = scene;
    this.rng = rng;
    this.particles = [];
    this.pool = [];
    this.max = max;
    this.emitters = [];
    this.textures = { fire: glowTexture('#ff8a2a'), smoke: makeSmokeTexture(), spark: glowTexture('#ffe2a0'), flash: glowTexture('#fff4d6') };
  }

  spawn(kind, pos, vel, life, size, grow = 1) {
    if (this.particles.length >= this.max) return null;
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      this.scene.add(s);
    }
    const mat = s.material;
    mat.map = this.textures[kind === 'ember' ? 'spark' : kind];
    mat.blending = kind === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending;
    mat.toneMapped = kind === 'smoke';
    mat.color.set(kind === 'smoke' ? 0x4a4440 : 0xffffff);
    mat.needsUpdate = true;
    s.visible = true;
    s.position.copy(pos);
    s.material.rotation = this.rng() * Math.PI * 2;
    const p = { sprite: s, kind, vel: vel.clone(), life, age: 0, size, grow };
    this.particles.push(p);
    return p;
  }

  /** A fireball with sparks and a smoke column. */
  explode(pos, scale = 1) {
    const r = this.rng;
    for (let i = 0; i < 26 * scale; i += 1) this.spawn('fire', pos.clone().add(new THREE.Vector3(r() - 0.5, r() * 0.8, r() - 0.5)), new THREE.Vector3((r() - 0.5) * 9, r() * 7 + 2, (r() - 0.5) * 9).multiplyScalar(scale), 0.7 + r() * 0.5, 2.4 * scale, 2.2);
    for (let i = 0; i < 22 * scale; i += 1) this.spawn('spark', pos.clone(), new THREE.Vector3((r() - 0.5) * 22, r() * 16, (r() - 0.5) * 22), 0.5 + r() * 0.6, 0.35, 0.5);
    for (let i = 0; i < 16 * scale; i += 1) this.spawn('smoke', pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3((r() - 0.5) * 3, 2.5 + r() * 2, (r() - 0.5) * 3), 2.5 + r() * 1.5, 2.5 * scale, 3);
    this.spawn('flash', pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(), 0.25, 10 * scale, 1.5);
  }

  /** Attach a burning fire + smoke emitter (a wreck) at a position. */
  addFire(pos, strength = 1) {
    const e = { pos: pos.clone(), strength, acc: 0 };
    this.emitters.push(e);
    return e;
  }

  update(dt) {
    const r = this.rng;
    for (const e of this.emitters) {
      e.acc += dt * 34 * e.strength;
      while (e.acc > 1) {
        e.acc -= 1;
        const base = e.pos.clone().add(new THREE.Vector3((r() - 0.5) * 1.6 * e.strength, 0, (r() - 0.5) * 1.6 * e.strength));
        if (r() < 0.62) this.spawn('fire', base, new THREE.Vector3((r() - 0.5) * 0.8, 2.4 + r() * 2.2, (r() - 0.5) * 0.8), 0.55 + r() * 0.4, 1.3 * e.strength, 0.35);
        else this.spawn('smoke', base.add(new THREE.Vector3(0, 1.4, 0)), new THREE.Vector3((r() - 0.5) * 0.9 + 0.6, 2.6 + r() * 1.4, (r() - 0.5) * 0.9), 2.6 + r() * 1.6, 1.6 * e.strength, 3.4);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        this.pool.push(p.sprite);
        this.particles.splice(i, 1);
        continue;
      }
      const k = p.age / p.life;
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.kind === 'spark') p.vel.y -= 14 * dt;
      else p.vel.multiplyScalar(1 - 1.4 * dt);
      const size = p.size * (1 + (p.grow - 1) * k);
      p.sprite.scale.set(size, size, 1);
      if (p.kind === 'fire') {
        p.sprite.material.color.setRGB(1, 0.75 - k * 0.45, 0.35 - k * 0.3);
        p.sprite.material.opacity = (1 - k) * 0.9;
      } else if (p.kind === 'smoke') {
        p.sprite.material.opacity = Math.sin(k * Math.PI) * 0.55;
      } else p.sprite.material.opacity = 1 - k;
    }
  }
}

function makeSmokeTexture() {
  return canvasTexture(128, 128, (ctx) => {
    for (let i = 0; i < 9; i += 1) {
      const x = 40 + ((i * 37) % 48);
      const y = 40 + ((i * 53) % 48);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 40);
      g.addColorStop(0, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
  });
}

/** A wrecked, burning car prop: an overturned charred sedan with a fire emitter. */
export function buildBurningWreck(scene, particles, x, z, heading = 0.6, police = false) {
  const model = buildSedan({ color: 0x2a2624, livery: police ? 'police' : null });
  const v = createVehicleState(model, police ? 'cruiser' : 'coupe', x, z, heading);
  syncVehicleModel(v);
  wreckVehicle(v);
  model.rotation.z = 0.12;
  scene.add(model);
  particles.addFire(new THREE.Vector3(x, 0.9, z), 1.1);
  const glow = glowSprite('#ff7a2a', 9, 0.55);
  glow.position.set(x, 1.6, z);
  scene.add(glow);
  return v;
}
