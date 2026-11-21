// The player: a low-poly humanoid model (shared with pedestrians, officers and the crew), the
// on-foot third-person controller, the chase camera rig for foot and car, weapon slots 1–6 with
// hitscan shooting, bright tracer rounds and muzzle flashes, carjacking with F, and health/armor.
import * as THREE from 'three';
import { ON_FOOT, WEAPONS } from './config.js';
import { resolveBuildingCollision } from './world.js';

const humanGeo = {};
function geo(key, make) {
  if (!humanGeo[key]) humanGeo[key] = make();
  return humanGeo[key];
}
const matCache = new Map();
function mat(color, rough = 0.75) {
  const k = `${color}-${rough}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  return matCache.get(k);
}

/**
 * Build a humanoid figure (feet at y = 0, facing −Z) with pivoting limbs.
 * options: skin, shirt, pants, hair, shoes, cap, helmet, scale
 */
export function buildHumanoid({ skin = 0xd9a47e, shirt = 0xffffff, pants = 0x2f3b52, hair = 0x22180f, shoes = 0x1b1b20, cap = null, helmet = null, scale = 1 } = {}) {
  const g = new THREE.Group();
  const root = new THREE.Group();
  g.add(root);
  const limb = (r0, r1, h) => geo(`limb${r0}${r1}${h}`, () => { const c = new THREE.CylinderGeometry(r0, r1, h, 7); c.translate(0, -h / 2, 0); return c; });
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [leg, x] of [[legL, -0.11], [legR, 0.11]]) {
    leg.position.set(x, 0.95, 0);
    const thigh = new THREE.Mesh(limb(0.085, 0.07, 0.48), mat(pants));
    leg.add(thigh);
    const shin = new THREE.Mesh(limb(0.068, 0.055, 0.44), mat(pants));
    shin.position.y = -0.48;
    leg.add(shin);
    const shoe = new THREE.Mesh(geo('shoe', () => new THREE.BoxGeometry(0.12, 0.08, 0.26)), mat(shoes, 0.5));
    shoe.position.set(0, -0.92, -0.05);
    leg.add(shoe);
    root.add(leg);
  }
  const hips = new THREE.Mesh(geo('hips', () => new THREE.BoxGeometry(0.36, 0.16, 0.22)), mat(pants));
  hips.position.y = 0.97;
  root.add(hips);
  const torso = new THREE.Mesh(geo('torso', () => { const c = new THREE.CylinderGeometry(0.21, 0.16, 0.52, 8); c.scale(1, 1, 0.65); return c; }), mat(shirt));
  torso.position.y = 1.3;
  root.add(torso);
  const neck = new THREE.Mesh(geo('neck', () => new THREE.CylinderGeometry(0.05, 0.06, 0.1, 6)), mat(skin));
  neck.position.y = 1.6;
  root.add(neck);
  const head = new THREE.Mesh(geo('head', () => { const s = new THREE.SphereGeometry(0.125, 12, 10); s.scale(0.92, 1.08, 1); return s; }), mat(skin, 0.6));
  head.position.y = 1.74;
  root.add(head);
  const hairMesh = new THREE.Mesh(geo('hair', () => new THREE.SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), mat(hair, 0.9));
  hairMesh.position.y = 1.76;
  hairMesh.rotation.x = 0.25;
  root.add(hairMesh);
  if (cap !== null) {
    const capMesh = new THREE.Mesh(geo('cap', () => new THREE.CylinderGeometry(0.135, 0.14, 0.08, 12)), mat(cap));
    capMesh.position.y = 1.84;
    root.add(capMesh);
    const brim = new THREE.Mesh(geo('brim', () => new THREE.BoxGeometry(0.2, 0.02, 0.14)), mat(cap));
    brim.position.set(0, 1.81, -0.15);
    root.add(brim);
  }
  if (helmet !== null) {
    const h = new THREE.Mesh(geo('helmet', () => new THREE.SphereGeometry(0.16, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6)), mat(helmet, 0.3));
    h.position.y = 1.74;
    root.add(h);
  }
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  for (const [arm, x] of [[armL, -0.25], [armR, 0.25]]) {
    arm.position.set(x, 1.52, 0);
    const upper = new THREE.Mesh(limb(0.058, 0.05, 0.32), mat(shirt));
    arm.add(upper);
    const fore = new THREE.Mesh(limb(0.048, 0.04, 0.3), mat(skin));
    fore.position.y = -0.32;
    arm.add(fore);
    const hand = new THREE.Mesh(geo('hand', () => new THREE.SphereGeometry(0.045, 6, 5)), mat(skin));
    hand.position.y = -0.63;
    arm.add(hand);
    root.add(arm);
  }
  armL.rotation.z = -0.08;
  armR.rotation.z = 0.08;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(scale);
  g.userData = {
    root,
    head,
    leftArm: armL,
    rightArm: armR,
    leftLeg: legL,
    rightLeg: legR,
    animateWalk(phase, amount = 0.6) {
      legL.rotation.x = Math.sin(phase) * amount;
      legR.rotation.x = -Math.sin(phase) * amount;
      if (!g.userData.aiming) {
        armL.rotation.x = -Math.sin(phase) * amount * 0.8;
        armR.rotation.x = Math.sin(phase) * amount * 0.8;
      }
      root.position.y = Math.abs(Math.cos(phase)) * 0.04;
    },
    sit() {
      legL.rotation.x = 1.4;
      legR.rotation.x = 1.4;
      armL.rotation.x = 1.0;
      armR.rotation.x = 1.0;
    },
    aim(twoHanded = true) {
      g.userData.aiming = true;
      // The body faces -Z, so a positive pitch swings the arms forward; the support hand angles in.
      armR.rotation.set(1.5, 0, -0.06);
      if (twoHanded) armL.rotation.set(1.38, 0, 0.5);
    },
    crouch() {
      root.position.y = -0.35;
      legL.rotation.x = 1.1;
      legR.rotation.x = -0.3;
    },
  };
  return g;
}

/** A small weapon model held in the right hand (SMG / pistol / rifle silhouettes). */
export function buildWeaponModel(id) {
  const g = new THREE.Group();
  const dark = mat(0x1a1c22, 0.4);
  const len = id === 'carbine' ? 0.75 : id === 'viper' ? 0.45 : id === 'breacher' ? 0.8 : 0.22;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, len), dark);
  body.position.z = -len / 2;
  g.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), dark);
  grip.position.set(0, -0.1, -0.04);
  grip.rotation.x = 0.25;
  g.add(grip);
  if (id === 'viper' || id === 'carbine') {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.07), dark);
    mag.position.set(0, -0.14, -len * 0.45);
    g.add(mag);
  }
  const accent = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.025, len * 0.6), mat(0x46e0ff, 0.3));
  accent.position.set(0, 0.06, -len * 0.5);
  g.add(accent);
  g.userData.muzzle = new THREE.Vector3(0, 0.02, -len - 0.02);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Tracers and muzzle flashes

const tracerGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true);
tracerGeo.rotateX(Math.PI / 2);
tracerGeo.translate(0, 0, 0.5); // Object3D.lookAt aims +Z at the impact point

/** Spawn a glowing tracer round from a muzzle to an impact point; it fades over `life` seconds. */
export function spawnTracer(scene, list, from, to, color = 0xffd27a, life = 0.09) {
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.position.copy(from);
  m.lookAt(to);
  m.scale.set(1, 1, from.distanceTo(to));
  scene.add(m);
  const t = { mesh: m, age: 0, life };
  list.push(t);
  return t;
}

/** Fade and remove tracers. */
export function updateTracers(scene, list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const t = list[i];
    t.age += dt;
    t.mesh.material.opacity = Math.max(0, 1 - t.age / t.life);
    if (t.age >= t.life) {
      scene.remove(t.mesh);
      t.mesh.material.dispose();
      list.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Camera

/**
 * The chase camera: low and tight behind the car, widening its field of view with speed; over
 * the shoulder on foot. Mouse look offsets yaw and pitch; the camera eases toward its goal.
 */
export function createCameraRig(camera) {
  const rig = {
    camera,
    yawOffset: 0,
    pitch: 0.18,
    position: new THREE.Vector3(0, 6, 12),
    look: new THREE.Vector3(),
    mode: 'car',
    shake: 0,
    update(target, heading, speed, dt, mode) {
      this.mode = mode;
      const car = mode === 'car';
      const dist = car ? 7.4 + Math.min(Math.abs(speed), 60) * 0.04 : 4.2;
      const height = car ? 2.35 + this.pitch * 3 : 1.9 + this.pitch * 2.5;
      const yaw = heading + this.yawOffset;
      const goal = new THREE.Vector3(target.x + Math.sin(yaw) * dist + (car ? 0 : Math.cos(yaw) * 0.8), height, target.z + Math.cos(yaw) * dist - (car ? 0 : Math.sin(yaw) * 0.8));
      const k = dt > 0 ? 1 - Math.exp(-dt * (car ? 6 : 10)) : 1;
      this.position.lerp(goal, k);
      const lookGoal = new THREE.Vector3(target.x - Math.sin(yaw) * 6, car ? 1.1 : 1.6, target.z - Math.cos(yaw) * 6);
      this.look.lerp(lookGoal, k);
      camera.position.copy(this.position);
      if (this.shake > 0) {
        camera.position.x += (Math.random() - 0.5) * this.shake;
        camera.position.y += (Math.random() - 0.5) * this.shake;
        this.shake = Math.max(0, this.shake - dt * 2);
      }
      camera.lookAt(this.look);
      const fov = car ? 60 + Math.min(Math.abs(speed), 70) * 0.18 : 58;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
    },
    snap() { this.position.copy(camera.position); },
  };
  return rig;
}

// ---------------------------------------------------------------------------------------------
// Player controller

/** Create the player on foot at (x, z). */
export function createPlayer(scene, x, z, career) {
  const model = buildHumanoid({ skin: 0xc98e62, shirt: 0xf6f2ea, pants: 0x2b3550, hair: 0x15100c, shoes: 0xffffff });
  const shirtPrint = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.02), new THREE.MeshStandardMaterial({ color: 0xff7a59 }));
  shirtPrint.position.set(0, 1.32, -0.12);
  model.userData.root.add(shirtPrint);
  const weaponHolder = new THREE.Group();
  weaponHolder.position.set(0, -0.62, -0.02);
  model.userData.rightArm.add(weaponHolder);
  scene.add(model);
  const ammo = {};
  for (const w of WEAPONS) ammo[w.id] = w.ammo;
  const player = {
    model,
    weaponHolder,
    weaponModel: null,
    x,
    z,
    heading: 0,
    mode: 'foot',
    vehicle: null,
    health: career?.health ?? ON_FOOT.maxHealth,
    armor: career?.armor ?? 0,
    weaponIndex: 0,
    ammo,
    owned: new Set(career?.weapons ?? ['fists', 'nine']),
    cooldown: 0,
    walkPhase: 0,
    tracers: [],
    dead: false,
  };
  selectWeapon(player, 0);
  return player;
}

/** Switch to weapon slot index (0–5) if owned; updates the hand model. */
export function selectWeapon(player, index) {
  const w = WEAPONS[index];
  if (!w || (!player.owned.has(w.id) && w.id !== 'fists')) return false;
  player.weaponIndex = index;
  if (player.weaponModel) player.weaponHolder.remove(player.weaponModel);
  player.weaponModel = w.id === 'fists' ? null : buildWeaponModel(w.id);
  if (player.weaponModel) {
    player.weaponModel.rotation.x = -Math.PI / 2;
    player.weaponHolder.add(player.weaponModel);
  }
  return true;
}

/** Move the player on foot. input: { forward, strafe, run }, yaw is the camera's heading. */
export function updatePlayerOnFoot(player, input, cameraYaw, dt, world) {
  const speed = input.run ? ON_FOOT.runSpeed : ON_FOOT.walkSpeed;
  const mx = input.strafe;
  const mz = input.forward;
  const moving = Math.abs(mx) + Math.abs(mz) > 0.01;
  if (moving) {
    const angle = cameraYaw + Math.atan2(-mx, mz);
    let diff = angle - player.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.heading += diff * Math.min(1, ON_FOOT.turnRate * dt);
    player.x += -Math.sin(angle) * speed * dt;
    player.z += -Math.cos(angle) * speed * dt;
    player.walkPhase += dt * speed * 2.2;
    const push = resolveBuildingCollision(world, player.x, player.z, 0.4);
    if (push) { player.x += push.x; player.z += push.z; }
  }
  if (input.aiming) {
    player.heading = cameraYaw;
    player.model.userData.aim(player.weaponIndex !== 1);
  } else player.model.userData.aiming = false;
  player.model.userData.animateWalk(player.walkPhase, moving ? (input.run ? 0.8 : 0.5) : 0);
  player.model.position.set(player.x, groundHeightAt(world, player.x, player.z), player.z);
  player.model.rotation.y = player.heading;
  player.cooldown = Math.max(0, player.cooldown - dt);
}

/** The walkable ground height (the Mercado boardwalk is raised). */
export function groundHeightAt(world, x, z) {
  const b = world.market?.bounds;
  if (b && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 0.6;
  if (x > -24 && x < -11) return 0.16;
  if (x > 11 && x < 17) return 0.16;
  return 0;
}

/**
 * Fire the current weapon from origin along direction. targets: [{ x, y, z, radius, hit(dmg) }].
 * Spawns tracers, consumes ammo, and returns { fired, hits: [target], muzzle }.
 */
export function fireWeapon(player, scene, origin, direction, targets, rng = Math.random) {
  const w = WEAPONS[player.weaponIndex];
  if (player.cooldown > 0) return { fired: false, hits: [] };
  if (w.id !== 'fists' && player.ammo[w.id] <= 0) return { fired: false, hits: [], empty: true };
  player.cooldown = 1 / w.rate;
  if (Number.isFinite(player.ammo[w.id])) player.ammo[w.id] -= 1;
  const hits = [];
  const pellets = w.pellets || 1;
  for (let p = 0; p < pellets; p += 1) {
    const dir = direction.clone();
    dir.x += (rng() - 0.5) * w.spread * 2;
    dir.y += (rng() - 0.5) * w.spread * 2;
    dir.z += (rng() - 0.5) * w.spread * 2;
    dir.normalize();
    let best = null;
    let bestT = w.range;
    for (const t of targets) {
      const oc = new THREE.Vector3(t.x - origin.x, t.y - origin.y, t.z - origin.z);
      const proj = oc.dot(dir);
      if (proj < 0 || proj > bestT) continue;
      const d2 = oc.lengthSq() - proj * proj;
      if (d2 < t.radius * t.radius) { best = t; bestT = proj; }
    }
    const end = origin.clone().addScaledVector(dir, bestT);
    if (w.id !== 'fists') spawnTracer(scene, player.tracers, origin, end, w.id === 'flare' ? 0xff4a3d : 0xffd27a, 0.08);
    if (best) { best.hit(w.damage, end); hits.push(best); }
  }
  return { fired: true, hits, weapon: w };
}

/** Apply damage to the player: armor soaks 60% until it runs out. */
export function damagePlayer(player, amount) {
  const soaked = Math.min(player.armor, amount * 0.6);
  player.armor -= soaked;
  player.health = Math.max(0, player.health - (amount - soaked));
  if (player.health <= 0) player.dead = true;
}

/** Find the nearest enterable vehicle state within range of the player. */
export function findNearestVehicle(player, vehicles) {
  let best = null;
  let bestD = ON_FOOT.enterCarRange;
  for (const v of vehicles) {
    if (v.wrecked) continue;
    const d = Math.hypot(v.x - player.x, v.z - player.z);
    if (d < bestD) { best = v; bestD = d; }
  }
  return best;
}

/** Carjack or enter a vehicle: the player takes the wheel; returns true when a driver was thrown out. */
export function enterVehicle(player, v) {
  const stolen = !v.playerOwned;
  v.stolen = true;
  v.playerOwned = true;
  player.mode = 'car';
  player.vehicle = v;
  player.model.visible = false;
  return stolen;
}

/** Step out on the driver's side. */
export function exitVehicle(player, world) {
  const v = player.vehicle;
  if (!v) return;
  const side = new THREE.Vector3(Math.cos(v.heading), 0, -Math.sin(v.heading));
  player.x = v.x - side.x * 2;
  player.z = v.z - side.z * 2;
  player.heading = v.heading;
  player.mode = 'foot';
  player.vehicle = null;
  player.model.visible = true;
  player.model.position.set(player.x, groundHeightAt(world, player.x, player.z), player.z);
}
