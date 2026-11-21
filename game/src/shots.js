// Deterministic screenshot scenes behind ?shot=chase|shootout|garage|map (&seed=N). Each one is
// staged from the real game systems — the generated city, vehicle builders and physics state,
// PSPD dispatch units and Air-1, the campaign, crew, dialogue, garage shop and HUD — at fixed
// positions and a fixed clock, so the same seed always renders the same frame. When the frame
// is on screen window.__SHOT_READY__ is set for the capture tool.
import * as THREE from 'three';
import { CHARACTERS, MISSIONS, VEHICLES, WORLD, createSeededRandom } from './config.js';
import { applyLightingPreset, buildCoastalCity, createEnvironmentMap } from './world.js';
import { ParticleSystem, buildBurningWreck, buildScooter, buildSedan, buildSportsCar, createVehicleState, glowSprite, glowTexture, syncVehicleModel, updateHelicopter, aimSearchlight, updateLightbar } from './vehicles.js';
import { buildHumanoid, buildWeaponModel, createPlayer, enterVehicle, selectWeapon, spawnTracer } from './player.js';
import { animateOfficers, createDispatch, setWanted, spawnCruiser, spawnHelicopter, spawnRoadblock } from './police.js';
import { createCampaign, createCareer, createCrew, createDialogueQueue, sayLine, startMission, updateDialogue } from './missions.js';
import { buildGarageScene, showGarageUI, updateGarage } from './garage.js';
import { buildHudState, showWorldMap } from './hud.js';

/** The late-game career every scene shares: job 10 of 10, rank 6 Kingpin, $64,850. */
function stagedCareer() {
  const career = createCareer({
    cash: 64850,
    respect: 8450,
    missionIndex: 9,
    health: 86,
    armor: 62,
    weapons: ['fists', 'nine', 'viper', 'breacher', 'carbine', 'flare'],
    upgrades: ['engine', 'tires', 'nitro'],
  });
  career.completed = MISSIONS.slice(0, 9).map((m) => ({ id: m.id, medal: m.medal || 'gold' }));
  career.districtStanding = { playa: 62, mercado: 48, porto: 31, solar: 37, coral: 22, palmera: 30 };
  career.car = { tune: 3, topSpeed: 18, armor: 0, grip: 0.08, nitro: 1, condition: 0.94 };
  career.stats = { distanceKm: 1284.6, copsEvaded: 212, carsStolen: 147, headshots: 389, racesWon: 14, playMinutes: 1046 };
  return career;
}

function baseGame(world, career, seed) {
  const rng = createSeededRandom(seed * 101 + 7);
  const scene = world.scene;
  const particles = new ParticleSystem(scene, rng);
  const dispatch = createDispatch(scene, world, rng, { particles });
  const campaign = createCampaign(career);
  const crew = createCrew();
  const dialogue = createDialogueQueue();
  return { world, scene, rng, particles, dispatch, campaign, crew, dialogue, career, radio: { station: 'SOLAR 104.5 FM', track: 'Sunset Overdrive', color: '#ff9f5a' } };
}

/** Run the particle system forward with a fixed step so fires look established. */
function settleParticles(particles, seconds) {
  for (let t = 0; t < seconds; t += 1 / 30) particles.update(1 / 30);
}

/** A flat additive glow on the road: light from tail lamps, nitro and lightbars reflected on asphalt. */
function roadReflection(scene, x, z, color, w, l, opacity = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: glowTexture(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.06, z);
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------------------------------------

/** Golden-hour five-star chase up Ocean Drive: the cover shot. */
function stageChase(ctx, seed) {
  const career = stagedCareer();
  const world = buildCoastalCity({ seed, preset: 'golden' });
  const game = baseGame(world, career, seed);
  const { scene, dispatch, particles } = game;
  scene.environment = createEnvironmentMap(ctx.renderer, 'golden');
  const t = 7.35;

  // The hero car, mid-boost at 128 km/h.
  const hero = buildSportsCar({ spinning: true, nitro: true });
  const v = createVehicleState(hero, 'solara', 3.4, -40, 0.045);
  v.speed = 128 / 3.6;
  v.boosting = true;
  v.nitro = 0.78;
  v.condition = 0.94;
  v.steer = 0.06;
  v.yawRate = 0.05;
  v.wheelSpin = 3.1;
  syncVehicleModel(v);
  for (const f of hero.userData.flames) { f.visible = true; f.scale.setScalar(1.05); }
  scene.add(hero);
  roadReflection(scene, 3.35, -37.6, '#ff2340', 2.2, 1.6, 0.16);
  roadReflection(scene, 3.4, -36.9, '#3fdcff', 1.4, 1.8, 0.2);

  const player = createPlayer(scene, v.x, v.z, career);
  selectWeapon(player, 2);
  enterVehicle(player, v);
  v.playerOwned = true;
  game.player = player;

  // PSPD: two flanking cruisers with officers leaning out, more behind, a roadblock ahead.
  setWanted(dispatch, 5);
  const left = spawnCruiser(dispatch, -1.4, -51, 0.07, 'FIRING', { officer: 1 });
  const right = spawnCruiser(dispatch, 8.4, -45.5, -0.06, 'FLANKING', { officer: -1 });
  for (const u of [left, right]) { u.vehicle.speed = 34; u.vehicle.wheelSpin = 2; syncVehicleModel(u.vehicle); }
  const rammer = spawnCruiser(dispatch, 2.2, -16, 0.02, 'RAMMING');
  const pursuit = spawnCruiser(dispatch, -3.6, -6, 0.0, 'PURSUIT');
  for (const u of [rammer, pursuit]) syncVehicleModel(u.vehicle);
  const block = spawnRoadblock(dispatch, 5.2, -142);
  void block;
  left.callsign = 'VIPER-04';
  right.callsign = 'REEF-09';
  rammer.callsign = 'MARLIN-12';
  pursuit.callsign = 'GULL-17';
  dispatch.units.find((u) => u.tactic === 'ROADBLOCK').callsign = 'HAMMER-22';
  const heli = spawnHelicopter(dispatch, -6, -92);
  heli.model.position.set(-9, 22, -84);
  heli.model.rotation.set(0.12, 0.35, -0.08);
  updateHelicopter(heli.model, t);
  heli.model.userData.cone.material.uniforms.strength.value = 1.15;
  heli.model.userData.spot.intensity = 160;
  aimSearchlight(heli.model, new THREE.Vector3(v.x - 0.2, 0, v.z + 0.6), scene);
  heli.model.userData.pool.material.opacity = 0.22;
  for (const u of dispatch.units) {
    updateLightbar(u.vehicle.model, t);
    u.distance = Math.hypot(u.vehicle.x - v.x, u.vehicle.z - v.z);
    roadReflection(scene, u.vehicle.x, u.vehicle.z, (u.vehicle.model.userData.phase || 0) > 0.5 ? '#2a6bff' : '#ff2a4a', 4.4, 5.4, 0.14);
  }
  dispatch.inSight = true;
  dispatch.heli.distance = 52;
  dispatch.units.push({ callsign: 'ORCA-31', tactic: 'PURSUIT', distance: 96, vehicle: rammer.vehicle, ghost: true });
  dispatch.units.push({ callsign: 'TARPON-08', tactic: 'PURSUIT', distance: 131, vehicle: rammer.vehicle, ghost: true });
  animateOfficers(dispatch, 0.01);
  for (const u of [left, right]) { const o = u.vehicle.model.userData.officer; o.flash.visible = true; o.core.visible = true; }
  // Officer tracer rounds snapping past the Solara.
  left.vehicle.model.updateMatrixWorld(true);
  const muzzle = left.vehicle.model.userData.officer.flash.getWorldPosition(new THREE.Vector3());
  spawnTracer(scene, [], muzzle, new THREE.Vector3(v.x + 0.6, 1.1, v.z - 4), 0xffd27a, 99);
  right.vehicle.model.updateMatrixWorld(true);
  const muzzle2 = right.vehicle.model.userData.officer.flash.getWorldPosition(new THREE.Vector3());
  spawnTracer(scene, [], muzzle2, new THREE.Vector3(v.x + 0.4, 1.0, v.z + 1.5), 0xffd27a, 99);

  // A burning wreck mid-distance, off to the oncoming side; smoke drifting inland.
  buildBurningWreck(scene, particles, -14.6, -70, 0.9, true);
  particles.explode(new THREE.Vector3(-14.6, 1, -70), 0.5);
  particles.addFire(new THREE.Vector3(-14.3, 1.1, -70.6), 1.5);
  const fireGlow = glowSprite('#ff8a2a', 6, 0.9);
  fireGlow.position.set(-14.6, 1.4, -70);
  scene.add(fireGlow);
  const fireLight = world.pointPool[0];
  fireLight.position.set(-14.6, 2.5, -70);
  fireLight.color.set(0xff7a2a);
  fireLight.intensity = 60;
  fireLight.distance = 26;
  settleParticles(particles, 2.6);

  // Civilian traffic and a scooter on the right.
  const civ = [[-3.2, -70, Math.PI, 0xf7b7c8, null], [-8.4, -126, Math.PI, 0x58d6c9, null], [-3.0, -176, Math.PI, 0xffc23a, 'cab'], [8.6, -88, 0, 0xffffff, null], [-8.4, -116, Math.PI, 0x9bd2ff, null], [2.8, -230, 0, 0xb58cff, null]];
  for (const [x, z, h, color, livery] of civ) {
    const car = buildSedan({ color, livery });
    const s = createVehicleState(car, 'coupe', x, z, h);
    syncVehicleModel(s);
    scene.add(car);
  }
  const scooter = buildScooter();
  scooter.position.set(9.6, 0, -66);
  scooter.rotation.y = 0.1;
  scene.add(scooter);

  // Pedestrians on the right sidewalk watching the chase.
  const watchers = [[13.2, -52, 0xff7a59], [14.6, -58, 0x2fd3c6], [13.6, -75, 0xffc23a], [15.2, -80, 0xffffff], [12.8, -96, 0xb58cff]];
  for (const [x, z, shirt] of watchers) {
    const p = buildHumanoid({ skin: 0xc98e62, shirt, pants: 0x2f3b52 });
    p.position.set(x, 0.16, z);
    p.rotation.y = Math.PI / 2 + 0.4;
    scene.add(p);
  }

  world.setFocus(v.x, v.z - 26);
  world.update(t, 0);

  // Camera: low, tight 3/4 rear-quarter.
  const cam = ctx.camera;
  cam.fov = 56;
  cam.position.set(v.x + 2.6, 2.05, v.z + 8.4);
  cam.lookAt(v.x - 2.4, 1.9, v.z - 20);
  cam.updateProjectionMatrix();

  startMission(game.campaign, 9);
  game.campaign.stage = 2;
  game.campaign.timer = 168;
  game.crew[0].remaining = 0;
  game.crew[1].remaining = 37;
  game.crew[2].remaining = 0;
  game.crew[2].active = 12;
  sayLine(game.dialogue, 'sora', 'Nine units and Air-1 on our tail! Hit the nitro and keep it on Ocean Drive — the marina gate closes at sunset!');
  updateDialogue(game.dialogue, 0);
  game.clock = '18:42';
  const hud = buildHudState(game, {
    sightText: 'Air-1 spotlight locked',
    dispatch: { rows: [
      { callsign: 'AIR-1', tactic: 'SPOTLIGHT', distance: 52, air: true },
      { callsign: 'MARLIN-12', tactic: 'RAMMING', distance: 24 },
      { callsign: 'VIPER-04', tactic: 'FIRING', distance: 5 },
      { callsign: 'REEF-09', tactic: 'FLANKING', distance: 9 },
      { callsign: 'HAMMER-22', tactic: 'ROADBLOCK', distance: 102 },
    ], total: 9, more: '+4 more units · roadblock on Ocean Drive' },
  });
  ctx.hud.update(hud);
  ctx.hud.drawMinimap({ x: v.x, z: v.z, heading: v.heading, t: 0.1, cones: true, objective: { x: 30, z: -470 },
    police: dispatch.units.filter((u) => !u.ghost).map((u) => ({ x: u.vehicle.x, z: u.vehicle.z, heading: u.vehicle.heading })).concat([{ x: heli.model.position.x, z: heli.model.position.z, air: true }]),
    icons: [{ x: 30, z: -470, label: '!', color: '#ffcf4a' }, { x: WORLD.garage.x, z: WORLD.garage.z, label: 'G', color: '#46e0ff' }] });
  return { scene, camera: cam };
}

/** Night ambush on foot in the Neon Mercado: SMG tracers, cover, a burning cruiser, a cab to steal. */
function stageShootout(ctx, seed) {
  const career = stagedCareer();
  career.missionIndex = 4;
  const world = buildCoastalCity({ seed, preset: 'night' });
  applyLightingPreset(world, 'night');
  const game = baseGame(world, career, seed);
  const { scene, dispatch, particles } = game;
  scene.environment = createEnvironmentMap(ctx.renderer, 'night');
  const deckY = 0.6;
  const px = -42.4;
  const pz = 252;

  const player = createPlayer(scene, px, pz, career);
  selectWeapon(player, 2);
  player.heading = 0.12;
  player.model.position.set(px, deckY, pz);
  player.model.rotation.y = player.heading;
  player.model.userData.aim(true);
  player.model.userData.leftLeg.rotation.x = 0.35;
  player.model.userData.rightLeg.rotation.x = -0.25;
  player.ammo.viper = 196;
  game.player = player;

  // The Palma Cab parked at the stall row, ready to steal.
  const cab = buildSedan({ color: VEHICLES.cab.color, livery: 'cab' });
  const cabState = createVehicleState(cab, 'cab', -35.6, 245.5, 0.55);
  syncVehicleModel(cabState);
  cab.position.y = deckY;
  scene.add(cab);

  // Enemies: cartel gunmen behind crates and barrels, PSPD officers by the wreck.
  const enemies = [
    { x: -47.5, z: 238, shirt: 0x1b1b22, pants: 0x3a2a1a, crouch: true, fire: true },
    { x: -38.2, z: 232, shirt: 0xd42a3a, pants: 0x1b1b22, crouch: false, fire: true },
    { x: -44.6, z: 224, shirt: 0x1d3b7a, pants: 0x0f1626, cap: 0x0f1626, crouch: false, fire: true },
    { x: -50.2, z: 220, shirt: 0x1d3b7a, pants: 0x0f1626, cap: 0x0f1626, crouch: true, fire: false },
    { x: -40.5, z: 241, shirt: 0x2a2a33, pants: 0x3a2a1a, crouch: true, fire: false, down: true },
  ];
  const crates = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 });
  const targets = [];
  for (const e of enemies) {
    const m = buildHumanoid({ skin: 0xb67a52, shirt: e.shirt, pants: e.pants, cap: e.cap ?? null });
    m.position.set(e.x, deckY, e.z);
    m.rotation.y = Math.PI + Math.atan2(px - e.x, pz - e.z) * -1 + Math.PI;
    m.lookAt(px, deckY, pz);
    m.rotation.y += Math.PI;
    if (e.down) { m.rotation.set(-Math.PI / 2, 0, 0.4); m.position.y = deckY + 0.15; }
    else {
      m.userData.aim(true);
      if (e.crouch) m.userData.crouch();
      const gun = buildWeaponModel(e.cap ? 'nine' : 'viper');
      gun.rotation.x = -Math.PI / 2;
      gun.position.y = -0.62;
      m.userData.rightArm.add(gun);
    }
    scene.add(m);
    if (!e.down) {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.0), crates);
      cover.position.set(e.x + 0.3, deckY + 0.55, e.z + 1.3);
      cover.castShadow = true;
      if (e.crouch) scene.add(cover);
    }
    targets.push({ e, m });
  }
  // Player's Viper SMG: muzzle flash and a burst of tracers into the cover line.
  player.model.updateMatrixWorld(true);
  const muzzle = new THREE.Vector3();
  player.weaponModel.localToWorld(muzzle.copy(player.weaponModel.userData.muzzle));
  const flash = glowSprite('#ffe2a0', 1.6, 1);
  flash.position.copy(muzzle);
  scene.add(flash);
  const flashCore = glowSprite('#ffffff', 0.6, 1);
  flashCore.position.copy(muzzle);
  scene.add(flashCore);
  const hitSpots = [[-38.0, 1.6, 232.3], [-38.6, 1.2, 233], [-37.6, 1.9, 231.5], [-45.2, 1.5, 238.8]];
  for (const [hx, hy, hz] of hitSpots) {
    spawnTracer(scene, [], muzzle.clone().add(new THREE.Vector3(0, 0, -0.05)), new THREE.Vector3(hx, hy, hz), 0xffcf5a, 99);
    const spark = glowSprite('#ffd27a', 0.9, 0.9);
    spark.position.set(hx, hy, hz);
    scene.add(spark);
  }
  // Enemy fire back: red-orange tracers and muzzle flashes.
  for (const { e, m } of targets) {
    if (!e.fire) continue;
    const from = new THREE.Vector3(e.x, deckY + (e.crouch ? 1.15 : 1.5), e.z).add(new THREE.Vector3(px - e.x, 0, pz - e.z).normalize().multiplyScalar(0.7));
    const f = glowSprite('#ffb05a', 1.1, 1);
    f.position.copy(from);
    scene.add(f);
    spawnTracer(scene, [], from, new THREE.Vector3(px + 1.6 + (e.x - px) * 0.05, deckY + 1.4, pz - 1.5), 0xff6a3a, 99);
    void m;
  }
  // Burning cruiser at the end of the aisle and an exploding barrel.
  const wreck = buildBurningWreck(scene, particles, -44.5, 208, 1.2, true);
  wreck.model.position.y = deckY;
  particles.emitters[0].pos.y = deckY + 0.9;
  particles.explode(new THREE.Vector3(-44.5, deckY + 1, 208), 0.6);
  settleParticles(particles, 2.4);
  setWanted(dispatch, 3);
  const c1 = spawnCruiser(dispatch, -6, 228, 0.3, 'FIRING');
  const c2 = spawnCruiser(dispatch, 4, 205, -0.2, 'FLANKING');
  c1.callsign = 'VIPER-04';
  c2.callsign = 'REEF-09';
  for (const u of dispatch.units) { updateLightbar(u.vehicle.model, 0.2); u.distance = Math.hypot(u.vehicle.x - px, u.vehicle.z - pz); }
  dispatch.inSight = true;

  // Night lights: lanterns, neon spill and the fire.
  const lights = [[-44, 5, 250, 0xff4fd8, 30], [-40, 5, 236, 0x46e0ff, 30], [-44.5, 3, 209, 0xff7a2a, 60], [-35, 4, 248, 0xffcf4a, 18], [-52, 4, 240, 0x46e0ff, 22], [-41, 4, 256, 0xff4fd8, 14]];
  lights.forEach(([x, y, z, c, i], k) => { const l = world.pointPool[k]; l.position.set(x, y, z); l.color.set(c); l.intensity = i; l.distance = 34; });
  world.setFocus(px, pz - 20);
  world.update(3, 0);

  const cam = ctx.camera;
  cam.fov = 58;
  cam.position.set(px + 1.15, deckY + 2.05, pz + 4.4);
  cam.lookAt(px - 1.6, deckY + 1.55, pz - 14);
  cam.updateProjectionMatrix();

  startMission(game.campaign, 4);
  game.campaign.stage = 2;
  game.campaign.timer = 121;
  game.crew[0].remaining = 22;
  game.crew[1].remaining = 0;
  game.crew[2].active = 15;
  game.clock = '23:16';
  game.radio = { station: 'NEON TIDE 98.1', track: 'Midnight Mercado', color: '#ff4fd8' };
  sayLine(game.dialogue, 'nadia', 'Two shooters behind the crates, one more by the cruiser! Grab that cab — I’ll open the north gate.');
  updateDialogue(game.dialogue, 0);
  const hud = buildHudState(game, {
    sightText: 'Officers have eyes on you',
    dispatch: { rows: [
      { callsign: 'VIPER-04', tactic: 'FIRING', distance: 34 },
      { callsign: 'REEF-09', tactic: 'FLANKING', distance: 58 },
      { callsign: 'GULL-17', tactic: 'ROADBLOCK', distance: 140 },
      { callsign: 'CARTEL ×3', tactic: 'FIRING', distance: 26 },
    ], total: 6, more: '+2 more units · Air-1 inbound' },
    prompt: '<kbd>F</kbd><span>STEAL PALMA CAB</span>',
    callout: '<b style="color:#7dff9b">EYES UP</b> · Nadia marked 4 hostiles',
  });
  ctx.hud.update(hud);
  ctx.hud.drawMinimap({ x: px, z: pz, heading: player.heading, t: 0.1, cones: true, objective: { x: -20, z: 160 },
    police: dispatch.units.map((u) => ({ x: u.vehicle.x, z: u.vehicle.z, heading: u.vehicle.heading })).concat(enemies.filter((e) => !e.down).map((e) => ({ x: e.x, z: e.z, heading: 0 }))),
    icons: [{ x: -20, z: 160, label: '!', color: '#ffcf4a' }, { x: -35.6, z: 245.5, label: 'C', color: '#ffc23a' }] });
  return { scene, camera: cam };
}

/** Chrome & Torque Customs showroom with the shop open. */
function stageGarage(ctx, seed) {
  void seed;
  const career = stagedCareer();
  const garage = buildGarageScene(career);
  updateGarage(garage, 0);
  garage.table.rotation.y = 0.15;
  garage.scene.environment = createEnvironmentMap(ctx.renderer, 'night');
  ctx.hud.setVisible(false);
  showGarageUI(ctx.overlay, career, { selected: 'engine' });
  garage.camera.aspect = ctx.aspect;
  garage.camera.updateProjectionMatrix();
  return { scene: garage.scene, camera: garage.camera };
}

/** World map / progression / saves screen over a dimmed city. */
function stageMap(ctx, seed) {
  const career = stagedCareer();
  const world = buildCoastalCity({ seed, preset: 'golden' });
  const cam = ctx.camera;
  cam.position.set(60, 140, 120);
  cam.lookAt(0, 0, -80);
  ctx.hud.setVisible(false);
  const saves = [
    { slot: 1, empty: false, label: 'Job 10 · Solar Eclipse', cash: 64850, completed: 9 },
    { slot: 2, empty: false, label: 'Job 7 · Dry Dock', cash: 31200, completed: 6 },
    { slot: 3, empty: false, label: 'Job 3 · Pink Slips', cash: 8900, completed: 2 },
  ];
  showWorldMap(ctx.overlay, { career, completion: 74.5, saves, player: { x: 3.4, z: -40, heading: 0 }, rank: { rank: 6, title: 'KINGPIN' } });
  return { scene: world.scene, camera: cam };
}

const SCENES = { chase: stageChase, shootout: stageShootout, garage: stageGarage, map: stageMap };

/** Stage the named scene and render it; sets window.__SHOT_READY__ after two painted frames. */
export function runShot(name, seed, ctx) {
  const stage = SCENES[name] || stageChase;
  const { scene, camera } = stage(ctx, seed);
  let frames = 0;
  const paint = () => {
    ctx.renderer.render(scene, camera);
    frames += 1;
    if (frames < 3) requestAnimationFrame(paint);
    else window.__SHOT_READY__ = true;
  };
  requestAnimationFrame(paint);
  return { scene, camera, speaker: CHARACTERS.sora };
}
