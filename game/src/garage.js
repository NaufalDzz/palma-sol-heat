// Chrome & Torque Customs: the showroom where the player's Solara GT turns on a glowing neon-grid
// turntable under volumetric spotlights, and the shop logic behind it — car upgrades that change
// real driving stats (top speed, acceleration, armor, grip, nitro), resprays that clear heat,
// repairs, and weapons & gear. Rico Delgado runs the counter.
import * as THREE from 'three';
import { CHARACTERS, GARAGE_UPGRADES, GARAGE_WEAPONS, VEHICLES } from './config.js';
import { buildSportsCar, glowSprite } from './vehicles.js';
import { canvasTexture, makeNeonTexture } from './world.js';
import { makePortraitSVG } from './hud.js';

const NARROW = '"Nimbus Sans Narrow", "Noto Sans", sans-serif';

function gridTexture() {
  const tex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, 256, 256);
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff4fd8';
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.shadowColor = '#46e0ff';
    ctx.strokeStyle = 'rgba(70,224,255,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
  }, { repeat: true });
  return tex;
}

function volumetricCone(color, radius, height) {
  const geo = new THREE.CylinderGeometry(0.2, radius, height, 32, 1, true);
  geo.translate(0, -height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, h: { value: height } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; uniform float h; void main(){ vY = -position.y / h; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 color; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN,vV)), 1.6); gl_FragColor = vec4(color * e * (1.0 - vY*0.75) * 0.32, 1.0); }',
  });
  return new THREE.Mesh(geo, mat);
}

/** Build the showroom scene: floor grid, turntable, the Solara GT, spotlights, walls, tools and the neon sign. */
export function buildGarageScene(career) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060f);
  scene.fog = new THREE.Fog(0x07060f, 18, 46);
  const floorTex = gridTexture();
  floorTex.repeat.set(24, 24);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: floorTex, emissiveMap: floorTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.22, metalness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // Turntable: a dark disc with two glowing rings.
  const table = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.24, 64), new THREE.MeshStandardMaterial({ color: 0x15131f, metalness: 0.8, roughness: 0.25 }));
  disc.position.y = 0.12;
  disc.receiveShadow = true;
  table.add(disc);
  for (const [r, c] of [[4.3, 0xff4fd8], [3.2, 0x46e0ff]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 96), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    table.add(ring);
  }
  scene.add(table);
  const car = buildSportsCar({ color: VEHICLES.solara.color, nitro: false });
  car.position.y = 0.24;
  car.rotation.y = -2.35;
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  table.add(car);
  // Lights: key spot, rim spots in magenta and cyan, soft ambient.
  scene.add(new THREE.HemisphereLight(0x8f86ff, 0x1a0f24, 0.55));
  const key = new THREE.SpotLight(0xfff2e0, 380, 40, 0.5, 0.5, 1.2);
  key.position.set(3, 12, 6);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key, key.target);
  for (const [x, z, c] of [[-7, -3, 0xff4fd8], [7, -4, 0x46e0ff], [0, 8, 0xffcf4a]]) {
    const s = new THREE.SpotLight(c, 260, 40, 0.55, 0.6, 1.3);
    s.position.set(x, 10, z);
    s.target.position.set(0, 0.5, 0);
    scene.add(s, s.target);
  }
  // Visible light shafts from the ceiling rig.
  for (const [x, z, c] of [[-3.2, -1, 0xff8af0], [3.2, -1.5, 0x8af4ff], [0, 2.5, 0xfff0c8]]) {
    const cone = volumetricCone(c, 3.6, 11);
    cone.position.set(x, 11, z);
    cone.rotation.z = -x * 0.03;
    scene.add(cone);
    const lamp = glowSprite(`#${new THREE.Color(c).getHexString()}`, 1.6, 1);
    lamp.position.set(x, 11, z);
    scene.add(lamp);
  }
  // Back wall with the neon sign, tool chests and tyre stacks.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1726, roughness: 0.8, metalness: 0.2 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 0.5), wallMat);
  wall.position.set(0, 7, -12);
  scene.add(wall);
  for (let i = -3; i <= 3; i += 1) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 9, 0.1), new THREE.MeshStandardMaterial({ color: 0x23203a, roughness: 0.6, metalness: 0.4 }));
    panel.position.set(i * 5.2, 5.5, -11.7);
    scene.add(panel);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.4), new THREE.MeshBasicMaterial({ map: makeNeonTexture('CHROME & TORQUE CUSTOMS', '#ff4fd8', { w: 1024, h: 160, font: 'italic bold 108px "Nimbus Sans Narrow", sans-serif' }), transparent: true, toneMapped: false, depthWrite: false }));
  sign.position.set(0, 9.6, -11.6);
  scene.add(sign);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(34, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: 0x46e0ff, toneMapped: false }));
  stripe.position.set(0, 8.1, -11.6);
  scene.add(stripe);
  const chestMat = new THREE.MeshStandardMaterial({ color: 0xd42a3a, metalness: 0.6, roughness: 0.35 });
  for (const x of [-11, -8.6, 9.5]) {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 1), chestMat);
    chest.position.set(x, 0.9, -10.8);
    scene.add(chest);
    for (let d = 0; d < 4; d += 1) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xdfe6f0, metalness: 1, roughness: 0.2 }));
      handle.position.set(x, 0.4 + d * 0.38, -10.27);
      scene.add(handle);
    }
  }
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x121216, roughness: 0.9 });
  for (const [x, z] of [[12, -8], [13.2, -6.4], [-13, -7]]) {
    for (let k = 0; k < 4; k += 1) {
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.2, 8, 20), tyreMat);
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(x, 0.2 + k * 0.4, z);
      scene.add(tyre);
    }
  }
  const lift = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), new THREE.MeshStandardMaterial({ color: 0xffcf4a, metalness: 0.4, roughness: 0.4 }));
  lift.position.set(-9, 2.5, -6);
  scene.add(lift);
  const camera = new THREE.PerspectiveCamera(38, 1.6, 0.1, 200);
  camera.position.set(-1.2, 3.1, 11.2);
  camera.lookAt(-1.2, 0.9, 0);
  return { scene, camera, table, car, career };
}

/** Spin the turntable. */
export function updateGarage(garage, t) {
  garage.table.rotation.y = t * 0.25;
}

/** Driving stats (0–100) shown on the bars, from the base class plus owned upgrades. */
export function computeCarStats(career) {
  const b = VEHICLES.solara;
  const u = career.car;
  return {
    topSpeed: Math.min(100, ((b.topSpeed + (u.topSpeed || 0)) / 280) * 100),
    acceleration: Math.min(100, ((b.accel + (u.topSpeed ? 2 : 0) + (u.nitro ? 2 : 0)) / 20) * 100),
    armor: Math.min(100, (b.armor + (u.armor || 0)) * 100),
    handling: Math.min(100, (b.grip + (u.grip || 0)) * 100),
  };
}

/** Buy an upgrade or weapon by id. Returns { ok, message }. ctx.dispatch lets a respray clear heat. */
export function purchase(career, id, ctx = {}) {
  const up = GARAGE_UPGRADES.find((u) => u.id === id);
  const wp = GARAGE_WEAPONS.find((w) => w.id === id);
  const item = up || wp;
  if (!item) return { ok: false, message: 'Not sold here' };
  const owned = career.upgrades.includes(id) || career.weapons.includes(id);
  const repeatable = ['repair', 'respray', 'ammo'].includes(id);
  if (owned && !repeatable) return { ok: false, message: 'Already owned' };
  if (career.cash < item.price) return { ok: false, message: 'Not enough cash' };
  career.cash -= item.price;
  if (up) {
    if (!repeatable) career.upgrades.push(id);
    if (up.stat === 'condition') career.car.condition = 1;
    else if (up.stat === 'heat' && ctx.dispatch) ctx.dispatch.wanted = Math.max(0, ctx.dispatch.wanted - 1);
    else if (up.stat !== 'heat') { career.car[up.stat] = (career.car[up.stat] || 0) + up.amount; career.car.tune = Math.min(5, (career.car.tune || 1) + 1); }
  } else if (id === 'vest') career.armor = 100;
  else if (!repeatable) career.weapons.push(id);
  return { ok: true, message: `${item.name} installed` };
}

/** Apply the career's upgrades to a vehicle physics state. */
export function applyUpgrades(vehicle, career) {
  const u = career.car;
  vehicle.spec.topSpeed = VEHICLES.solara.topSpeed + (u.topSpeed || 0);
  vehicle.spec.armor = VEHICLES.solara.armor + (u.armor || 0);
  vehicle.spec.grip = VEHICLES.solara.grip + (u.grip || 0);
  vehicle.spec.accel = VEHICLES.solara.accel + (u.topSpeed ? 2 : 0);
}

/** Render the shop panels over the showroom. selected is the highlighted row id. */
export function showGarageUI(container, career, { selected = 'engine', message = '' } = {}) {
  container.classList.remove('hide');
  const stats = computeCarStats(career);
  const rico = CHARACTERS.rico;
  const ownedUp = new Set(career.upgrades);
  const ownedW = new Set(career.weapons);
  const row = (item, owned) => {
    const sel = item.id === selected;
    return `<div style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;margin-top:4px;background:${sel ? 'rgba(255,79,216,.18)' : 'rgba(255,255,255,.04)'};border:1px solid ${sel ? '#ff4fd8' : 'rgba(255,255,255,.08)'}">
      <div><div style="font-size:13.5px;font-weight:900">${item.name}</div>${item.desc ? `<div style="font-size:11px;color:#9fb0c8;font-weight:700">${item.desc}</div>` : ''}</div>
      ${owned ? '<span style="font-size:11px;font-weight:900;letter-spacing:.08em;background:#7dff9b;color:#0a0e16;padding:3px 8px;border-radius:4px">OWNED</span>' : `<span style="font:italic 900 17px ${NARROW};color:${career.cash >= item.price ? '#7dff9b' : '#ff5d73'}">$${item.price.toLocaleString('en-US')}</span>`}</div>`;
  };
  const bar = (label, v, color) => `<div style="display:grid;grid-template-columns:104px 1fr 34px;align-items:center;gap:8px;height:22px;font-size:11.5px;font-weight:900;letter-spacing:.08em"><span>${label}</span><span style="height:9px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden"><i style="display:block;height:100%;width:${v}%;background:${color};border-radius:5px"></i></span><span style="text-align:right">${Math.round(v)}</span></div>`;
  container.innerHTML = `
  <div style="position:absolute;left:18px;top:16px;width:350px;display:flex;flex-direction:column;gap:10px">
    <div class="pn" style="padding:12px 14px;border-left:4px solid #ff4fd8">
      <div style="font:italic 900 30px/1 ${NARROW};letter-spacing:.04em;background:linear-gradient(90deg,#ff4fd8,#46e0ff);-webkit-background-clip:text;color:transparent">CHROME &amp; TORQUE</div>
      <div style="font-size:11.5px;font-weight:900;letter-spacing:.3em;color:#9fb0c8">CUSTOMS · SOLAR CENTRO</div>
    </div>
    <div class="pn" style="padding:10px;display:grid;grid-template-columns:74px 1fr;gap:10px;border-left:4px solid ${rico.accent}">
      <div style="width:74px;height:74px;border-radius:8px;overflow:hidden">${makePortraitSVG(rico, 'rico')}</div>
      <div><div style="font:italic 900 17px ${NARROW};color:${rico.accent};letter-spacing:.04em">RICO DELGADO <small style="font:800 10px sans-serif;color:#9fb0c8;letter-spacing:.1em">MECHANIC</small></div>
      <div style="font-size:13.5px;font-weight:700;line-height:1.3;margin-top:3px">"Stage 3 and she'll outrun Air-1. Bring her back in one piece this time, sí?"</div></div>
    </div>
    <div class="pn" style="padding:11px 14px;border-color:rgba(70,224,255,.5)">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font:italic 900 22px ${NARROW};color:#46e0ff;letter-spacing:.05em">SOLARA GT</span><span style="font-size:11px;font-weight:900;color:#9fb0c8;letter-spacing:.1em">TUNE ${career.car.tune} · ${Math.round((career.car.condition ?? 1) * 100)}% COND.</span></div>
      ${bar('TOP SPEED', stats.topSpeed, 'linear-gradient(90deg,#ff7a59,#ffcf4a)')}
      ${bar('ACCELERATION', stats.acceleration, 'linear-gradient(90deg,#ff4fd8,#ff9ad5)')}
      ${bar('ARMOR', stats.armor, 'linear-gradient(90deg,#2f8bff,#7fc8ff)')}
      ${bar('HANDLING', stats.handling, 'linear-gradient(90deg,#2fd27a,#7dff9b)')}
      <div style="font-size:11px;color:#9fb0c8;font-weight:700;margin-top:4px">Preview: <b style="color:#ffcf4a">+18 KM/H</b> with Stage 3 Engine</div>
    </div>
  </div>
  <div style="position:absolute;right:18px;top:16px;width:370px;display:flex;flex-direction:column;gap:10px">
    <div class="pn" style="padding:6px 14px;align-self:flex-end;font:italic 900 32px ${NARROW};color:#7dff9b;border-color:rgba(125,255,155,.5)">$${career.cash.toLocaleString('en-US')}</div>
    <div class="pn" style="padding:10px 12px;border-color:rgba(255,79,216,.5)">
      <div style="font-size:12px;font-weight:900;letter-spacing:.14em;color:#ff4fd8">CAR UPGRADES</div>
      ${GARAGE_UPGRADES.map((u) => row(u, ownedUp.has(u.id))).join('')}
    </div>
    <div class="pn" style="padding:10px 12px;border-color:rgba(255,207,74,.5)">
      <div style="font-size:12px;font-weight:900;letter-spacing:.14em;color:#ffcf4a">WEAPONS &amp; GEAR</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 6px">${GARAGE_WEAPONS.map((w) => row(w, ownedW.has(w.id) || w.owned && ownedW.has(w.id))).join('')}</div>
    </div>
  </div>
  <div class="pn" style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:8px 16px;display:flex;gap:18px;font-size:12px;font-weight:800;color:#c3cfdf;letter-spacing:.05em">
    <span><b style="color:#ffcf4a">↑↓</b> select</span><span><b style="color:#ffcf4a">ENTER</b> buy</span><span><b style="color:#ffcf4a">G / ESC</b> back to the street</span>${message ? `<span style="color:#7dff9b">${message}</span>` : ''}
  </div>`;
}
