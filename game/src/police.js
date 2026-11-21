// PSPD — the Palma Sol Police Department. A dispatcher turns the wanted level (0–5 stars) into
// units: cruisers that each run a tactic (RAMMING, FIRING, FLANKING, ROADBLOCK, PURSUIT), the
// Air-1 helicopter holding its SPOTLIGHT on the suspect from 3 stars, and roadblocks from 4.
// Units only know where the player is while someone has line of sight; out of sight the stars
// drain on a search timer. Crew abilities can blind dispatch (BLACKOUT) or drop a star.
import * as THREE from 'three';
import { POLICE, WORLD } from './config.js';
import { buildHelicopter, buildSedan, createVehicleState, syncVehicleModel, updateHelicopter, updateLightbar, updateVehiclePhysics, aimSearchlight } from './vehicles.js';

/** Create the dispatcher for a scene. onPlayerHit(damage) is called when officers land shots. */
export function createDispatch(scene, world, rng, { onPlayerHit = () => {}, particles = null } = {}) {
  return {
    scene,
    world,
    rng,
    onPlayerHit,
    particles,
    wanted: 0,
    heat: 0,
    units: [],
    heli: null,
    inSight: false,
    searchTimer: 0,
    blackout: 0,
    lastKnown: new THREE.Vector3(),
    nextCallsign: 0,
    crimeLabel: '',
  };
}

/** Report a crime: raises heat and possibly the wanted level (capped at 5). */
export function reportCrime(d, severity, label = '') {
  d.heat += severity;
  const stars = Math.min(5, Math.max(d.wanted, Math.floor(d.heat / 10) + (severity >= 10 ? 1 : 0)));
  if (stars > d.wanted) d.wanted = stars;
  d.searchTimer = 0;
  if (label) d.crimeLabel = label;
}

/** Force the wanted level (missions and staged scenes). */
export function setWanted(d, stars) {
  d.wanted = Math.max(0, Math.min(5, stars));
  d.heat = d.wanted * 10;
  if (d.wanted === 0) clearPursuit(d);
}

/** Remove every unit and the helicopter. */
export function clearPursuit(d) {
  for (const u of d.units) d.scene.remove(u.vehicle.model);
  d.units.length = 0;
  if (d.heli) {
    d.scene.remove(d.heli.model);
    if (d.heli.model.userData.pool) d.scene.remove(d.heli.model.userData.pool);
    d.heli = null;
  }
}

/** Spawn one cruiser unit with a tactic at a world position and heading. */
export function spawnCruiser(d, x, z, heading, tactic, { officer = false } = {}) {
  const model = buildSedan({ livery: 'police', officer, spinning: true });
  model.userData.phase = d.rng();
  const vehicle = createVehicleState(model, 'cruiser', x, z, heading);
  syncVehicleModel(vehicle);
  d.scene.add(model);
  const callsign = `${POLICE.callsigns[d.nextCallsign % POLICE.callsigns.length]}-${String(4 + ((d.nextCallsign * 7) % 23)).padStart(2, '0')}`;
  d.nextCallsign += 1;
  const unit = { callsign, vehicle, tactic, fireCooldown: 1 + d.rng() * 2, flank: d.rng() < 0.5 ? -1 : 1, distance: 0 };
  d.units.push(unit);
  return unit;
}

/** Bring in Air-1 above a position. */
export function spawnHelicopter(d, x, z) {
  const model = buildHelicopter();
  model.position.set(x, 32, z);
  d.scene.add(model);
  d.heli = { model, callsign: 'AIR-1', tactic: 'SPOTLIGHT', x, z, distance: 0 };
  return d.heli;
}

/** Park a roadblock: two cruisers nose to nose across the road ahead of the suspect. */
export function spawnRoadblock(d, x, z) {
  const a = spawnCruiser(d, x - 3.2, z, Math.PI / 2 - 0.3, 'ROADBLOCK');
  const b = spawnCruiser(d, x + 3.2, z, -Math.PI / 2 + 0.3, 'ROADBLOCK');
  return [a, b];
}

function angleTo(v, tx, tz) {
  const desired = Math.atan2(-(tx - v.x), -(tz - v.z));
  let diff = desired - v.heading;
  return Math.atan2(Math.sin(diff), Math.cos(diff));
}

/** Can a unit at (x, z) see the target? Range and a coarse building-occlusion test. */
export function hasLineOfSight(d, x, z, tx, tz) {
  const dist = Math.hypot(tx - x, tz - z);
  if (dist > POLICE.sightRange) return false;
  const steps = Math.ceil(dist / 6);
  for (let i = 1; i < steps; i += 1) {
    const px = x + ((tx - x) * i) / steps;
    const pz = z + ((tz - z) * i) / steps;
    for (const c of d.world.colliders) if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ) return false;
  }
  return true;
}

/**
 * Advance dispatch: top up units for the wanted level, steer each by its tactic, fly Air-1,
 * test line of sight and run the search timer. target: { x, z, heading, speed }.
 */
export function updateDispatch(d, target, dt, t) {
  d.blackout = Math.max(0, d.blackout - dt);
  if (d.wanted <= 0) {
    if (d.units.length || d.heli) clearPursuit(d);
    d.inSight = false;
    return;
  }
  // Top up units: spawn behind the suspect on the road network.
  const want = POLICE.unitsPerStar[d.wanted] - (d.heli ? 1 : 0);
  const cruisers = d.units.filter((u) => u.tactic !== 'ROADBLOCK').length;
  if (cruisers < want && d.blackout <= 0) {
    const back = 70 + d.rng() * 40;
    const sx = Math.abs(target.x) < 40 ? (d.rng() < 0.5 ? 4 : -4) : target.x;
    const sz = target.z + Math.cos(target.heading) * back;
    const tactics = ['RAMMING', 'FIRING', 'FLANKING', 'PURSUIT'];
    spawnCruiser(d, sx, Math.max(WORLD.minZ + 20, Math.min(WORLD.maxZ - 20, sz)), target.heading, tactics[d.units.length % tactics.length], { officer: d.wanted >= 3 });
  }
  if (d.wanted >= POLICE.helicopterFromStar && !d.heli) spawnHelicopter(d, target.x + 30, target.z + 40);
  if (d.wanted >= POLICE.roadblockFromStar && !d.units.some((u) => u.tactic === 'ROADBLOCK')) {
    const ahead = 150;
    spawnRoadblock(d, Math.abs(target.x) < 40 ? 0 : target.x, target.z - Math.cos(target.heading) * ahead);
  }

  // Line of sight from any unit or Air-1.
  let seen = false;
  const blind = d.blackout > 0;
  for (const u of d.units) {
    u.distance = Math.hypot(u.vehicle.x - target.x, u.vehicle.z - target.z);
    if (!blind && hasLineOfSight(d, u.vehicle.x, u.vehicle.z, target.x, target.z)) seen = true;
  }
  if (d.heli) {
    d.heli.distance = Math.hypot(d.heli.x - target.x, d.heli.z - target.z);
    if (!blind && d.heli.distance < POLICE.sightRange * 1.3) seen = true;
  }
  d.inSight = seen;
  if (seen) { d.lastKnown.set(target.x, 0, target.z); d.searchTimer = 0; } else {
    d.searchTimer += dt;
    if (d.searchTimer > POLICE.searchSecondsPerStar * (1 + d.wanted * 0.4)) {
      d.wanted -= 1;
      d.heat = d.wanted * 10;
      d.searchTimer = 0;
      if (d.wanted === 0) clearPursuit(d);
    }
  }
  const goal = seen ? target : { x: d.lastKnown.x, z: d.lastKnown.z, heading: target.heading, speed: 0 };

  // Steer each unit by its tactic.
  for (const u of d.units) {
    const v = u.vehicle;
    updateLightbar(v.model, t);
    if (u.tactic === 'ROADBLOCK' || v.wrecked) { syncVehicleModel(v); continue; }
    let tx = goal.x;
    let tz = goal.z;
    const fx = -Math.sin(goal.heading || 0);
    const fz = -Math.cos(goal.heading || 0);
    if (u.tactic === 'FLANKING') { tx += Math.cos(goal.heading || 0) * 4 * u.flank + fx * 4; tz += -Math.sin(goal.heading || 0) * 4 * u.flank + fz * 4; }
    if (u.tactic === 'RAMMING') { tx += fx * 3; tz += fz * 3; }
    if (u.tactic === 'FIRING') { tx += Math.cos(goal.heading || 0) * 3.5 * u.flank; tz += -Math.sin(goal.heading || 0) * 3.5 * u.flank; }
    const ang = angleTo(v, tx, tz);
    const dist = Math.hypot(tx - v.x, tz - v.z);
    const throttle = blind ? 0.1 : dist > 12 ? 1 : dist > 5 ? 0.6 : (goal.speed || 0) > 3 ? 0.5 : -0.3;
    updateVehiclePhysics(v, { throttle, steer: THREE.MathUtils.clamp(ang * 2, -1, 1), handbrake: Math.abs(ang) > 1.2 && v.speed > 12, nitro: dist > 60 }, dt, d.world);
    syncVehicleModel(v);
    if (u.tactic === 'FIRING' && seen && u.distance < 30) {
      u.fireCooldown -= dt;
      if (u.fireCooldown <= 0) {
        u.fireCooldown = 0.6 + d.rng() * 0.8;
        if (d.rng() < 0.35) d.onPlayerHit(4 + d.rng() * 4, u);
      }
    }
  }
  // Air-1 circles above and keeps the light on the suspect.
  if (d.heli) {
    const h = d.heli;
    const orbit = t * 0.25;
    const hx = goal.x + Math.cos(orbit) * 18;
    const hz = goal.z + Math.sin(orbit) * 18 - 10;
    h.x += (hx - h.x) * Math.min(1, dt * 0.8);
    h.z += (hz - h.z) * Math.min(1, dt * 0.8);
    h.model.position.set(h.x, 30 + Math.sin(t * 0.7) * 1.2, h.z);
    h.model.rotation.y = Math.atan2(-(goal.x - h.x), -(goal.z - h.z));
    h.model.rotation.z = Math.sin(t * 0.5) * 0.06;
    updateHelicopter(h.model, t);
    aimSearchlight(h.model, new THREE.Vector3(goal.x, 0, goal.z), d.scene);
    h.model.userData.cone.visible = !blind;
  }
}

/** Rows for the PSPD DISPATCH panel: Air-1 first, then the nearest cruisers. */
export function getDispatchRows(d, limit = 5) {
  const rows = [];
  if (d.heli) rows.push({ callsign: d.heli.callsign, tactic: d.blackout > 0 ? 'SEARCHING' : 'SPOTLIGHT', distance: d.heli.distance, air: true });
  const sorted = [...d.units].sort((a, b) => a.distance - b.distance);
  for (const u of sorted) rows.push({ callsign: u.callsign, tactic: d.blackout > 0 ? 'SEARCHING' : u.tactic, distance: u.distance });
  return { rows: rows.slice(0, limit), total: d.units.length + (d.heli ? 1 : 0) };
}

/** The muzzle flash on leaning officers flickers while they fire. */
export function animateOfficers(d, t) {
  for (const u of d.units) {
    const o = u.vehicle.model.userData.officer;
    if (!o) continue;
    const on = u.tactic === 'FIRING' && d.inSight && ((t * 9 + u.flank) % 1) < 0.35;
    o.flash.visible = on;
    o.core.visible = on;
  }
}

