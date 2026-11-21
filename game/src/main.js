// Palma Sol: Neon Coast — boot and the game loop. Sets up the renderer (ACES filmic, soft
// shadows, a prefiltered sky environment), builds the coastal city, and runs the open world:
// driving and carjacking, gunplay on foot, PSPD pursuits with Air-1, the ten-job campaign, crew
// abilities, the radio, Chrome & Torque Customs, the map/pause screen and three save slots.
//
// ?shot=chase|shootout|garage|map&seed=N stages a deterministic screenshot instead (shots.js).
// ?autostart=1 skips the title screen and drops straight into play.
//
// Controls: WASD / arrows drive or walk · Space handbrake · Shift nitro / sprint · F enter or
// steal a car · click shoot · 1–6 weapons · Z X C crew · G garage · M map/pause · R radio · Esc.
import * as THREE from 'three';
import { DRIVING, NEW_GAME, WEAPONS, WORLD, createSeededRandom } from './config.js';
import { buildCoastalCity, createEnvironmentMap } from './world.js';
import { ParticleSystem, buildSportsCar, createTraffic, createVehicleState, syncVehicleModel, updateTraffic, updateVehiclePhysics, wreckVehicle } from './vehicles.js';
import { createCameraRig, createPlayer, damagePlayer, enterVehicle, exitVehicle, findNearestVehicle, fireWeapon, selectWeapon, updatePlayerOnFoot, updateTracers } from './player.js';
import { animateOfficers, createDispatch, reportCrime, setWanted, updateDispatch } from './police.js';
import { STAGE_LINES, completionPercent, createCampaign, createCareer, createCrew, createDialogueQueue, listSaves, loadGame, respectProgress, saveGame, sayLine, startMission, updateCrew, updateDialogue, updateMission, useCrewAbility } from './missions.js';
import { applyUpgrades, buildGarageScene, purchase, showGarageUI, updateGarage } from './garage.js';
import { buildHudState, createHUD, hideOverlay, showTitleScreen, showWorldMap } from './hud.js';
import { createAudio } from './audio.js';
import { runShot } from './shots.js';

const STEP = DRIVING.step;
/** Above this speed with no heat, a passing patrol may clock you for reckless driving. */
const SPEEDING_KMH = 150;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!shot });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2600);
const hud = createHUD(document.getElementById('ui'));
const overlay = document.getElementById('overlay');

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

if (shot) {
  runShot(shot, seed, { renderer, camera, hud, overlay, aspect: camera.aspect });
} else {
  startGame();
}

// ---------------------------------------------------------------------------------------------

function startGame() {
  const rng = createSeededRandom(seed);
  const world = buildCoastalCity({ seed, preset: 'golden' });
  const scene = world.scene;
  scene.environment = createEnvironmentMap(renderer, 'golden');
  const audio = createAudio();
  const particles = new ParticleSystem(scene, rng);
  const rig = createCameraRig(camera);

  const game = {
    world, scene, rng, particles, audio,
    career: createCareer(NEW_GAME),
    screen: 'title',
    clock: '18:42',
    time: 0,
    vehicles: [],
    radio: { station: '', track: '', color: '#ff9f5a' },
  };
  game.campaign = createCampaign(game.career);
  game.crew = createCrew();
  game.dialogue = createDialogueQueue();
  game.player = createPlayer(scene, 6, 40, game.career);
  game.dispatch = createDispatch(scene, world, rng, {
    particles,
    onPlayerHit: (dmg) => { damagePlayer(game.player, dmg); rig.shake = 0.15; },
  });

  // The player's own Solara GT parked on Ocean Drive, plus civilian traffic.
  const heroModel = buildSportsCar({ nitro: true });
  const hero = createVehicleState(heroModel, 'solara', 3, 30, 0);
  hero.playerOwned = true;
  applyUpgrades(hero, game.career);
  syncVehicleModel(hero);
  scene.add(heroModel);
  game.vehicles.push(hero);
  const traffic = createTraffic(scene, rng, 22, { nearZ: 0, spread: 420 });
  game.vehicles.push(...traffic);

  let garage = null;
  let garageSel = 'engine';

  // ---- Input ---------------------------------------------------------------------------------
  const keys = new Set();
  const pressed = new Set();
  let mouseDown = false;
  window.addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; audio.resume(); });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('mousemove', (e) => {
    if (game.screen !== 'play' || document.pointerLockElement !== canvas) return;
    rig.yawOffset = THREE.MathUtils.clamp(rig.yawOffset - e.movementX * 0.003, -1.4, 1.4);
    rig.pitch = THREE.MathUtils.clamp(rig.pitch + e.movementY * 0.002, -0.1, 0.6);
  });
  overlay.addEventListener('click', () => { if (game.screen === 'title') play(); });
  const down = (...codes) => codes.some((c) => keys.has(c));
  const hit = (...codes) => codes.some((c) => pressed.has(c));

  function play() {
    game.screen = 'play';
    hideOverlay(overlay);
    hud.setVisible(true);
    audio.resume();
    if (!game.campaign.active) {
      startMission(game.campaign);
      for (const [who, text] of STAGE_LINES[game.campaign.active.id] || []) sayLine(game.dialogue, who, text);
    }
  }

  function pause() {
    game.screen = 'map';
    const p = game.player.mode === 'car' ? game.player.vehicle : game.player;
    showWorldMap(overlay, { career: game.career, completion: completionPercent(game.career), saves: listSaves(), player: { x: p.x, z: p.z, heading: p.heading }, rank: respectProgress(game.career) });
    hud.setVisible(false);
  }

  function openGarage() {
    game.screen = 'garage';
    garage = buildGarageScene(game.career);
    garage.scene.environment = scene.environment;
    garage.camera.aspect = camera.aspect;
    garage.camera.updateProjectionMatrix();
    showGarageUI(overlay, game.career, { selected: garageSel });
    hud.setVisible(false);
  }

  function closeGarage() {
    garage = null;
    if (game.player.vehicle) applyUpgrades(game.player.vehicle, game.career);
    play();
  }

  // Title screen, or straight in.
  const hasSave = listSaves().some((s) => !s.empty);
  if (params.get('autostart') === '1') play();
  else { showTitleScreen(overlay, { hasSave }); hud.setVisible(false); }

  // ---- Simulation ------------------------------------------------------------------------------
  const shootTargets = () => game.dispatch.units.map((u) => ({
    x: u.vehicle.x, y: 1, z: u.vehicle.z, radius: 2.2,
    hit: (dmg) => { u.vehicle.condition -= dmg / 300; if (u.vehicle.condition <= 0 && !u.vehicle.wrecked) { wreckVehicle(u.vehicle); particles.explode(new THREE.Vector3(u.vehicle.x, 1, u.vehicle.z)); particles.addFire(new THREE.Vector3(u.vehicle.x, 0.9, u.vehicle.z)); audio.explosion(); reportCrime(game.dispatch, 6, 'Cop killer'); } },
  }));

  function step(dt) {
    const p = game.player;
    game.time += dt;
    const t = game.time;

    // Menus and toggles.
    if (hit('KeyM')) { pause(); return; }
    if (hit('KeyG')) {
      if (Math.hypot((p.vehicle || p).x - WORLD.garage.x, (p.vehicle || p).z - WORLD.garage.z) < 40 || game.dispatch.wanted === 0) { openGarage(); return; }
      hud.toast('Chrome & Torque Customs: lose the heat first');
    }
    if (hit('KeyR')) { audio.nextStation(); audio.ui(); }
    for (let i = 0; i < 6; i += 1) if (hit(`Digit${i + 1}`) && selectWeapon(p, i)) audio.ui();
    for (const [code, key] of [['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C']]) {
      if (!hit(code)) continue;
      const used = useCrewAbility(game.crew, key, { dispatch: game.dispatch });
      if (used) { hud.toast(`${used.ability} · ${used.name}`); sayLine(game.dialogue, used.id, `${used.ability} — ${used.effect.toLowerCase()}.`); }
    }

    // Enter / steal / exit.
    if (hit('KeyF')) {
      if (p.mode === 'car') exitVehicle(p, world);
      else {
        const v = findNearestVehicle(p, game.vehicles);
        if (v) {
          const stolen = enterVehicle(p, v);
          if (stolen) { game.career.stats.carsStolen += 1; reportCrime(game.dispatch, 4, 'Grand theft auto'); }
        }
      }
    }

    // Movement.
    const forward = (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0);
    const steer = (down('KeyA', 'ArrowLeft') ? 1 : 0) - (down('KeyD', 'ArrowRight') ? 1 : 0);
    if (p.mode === 'car') {
      const v = p.vehicle;
      const impact = updateVehiclePhysics(v, { throttle: forward, steer, handbrake: down('Space'), nitro: down('ShiftLeft', 'ShiftRight') }, dt, world);
      if (impact > 8) { v.condition = Math.max(0, v.condition - impact / 400); rig.shake = Math.min(0.6, impact / 30); audio.crash(); }
      syncVehicleModel(v);
      p.x = v.x;
      p.z = v.z;
      game.career.stats.distanceKm += Math.abs(v.speed) * dt / 1000;
      if (Math.abs(v.speed) > SPEEDING_KMH / 3.6 && game.dispatch.wanted === 0 && game.rng() < dt * 0.02) reportCrime(game.dispatch, 3, 'Reckless driving');
    } else {
      updatePlayerOnFoot(p, { forward, strafe: -steer, run: down('ShiftLeft', 'ShiftRight'), aiming: mouseDown }, camera.rotation.y, dt, world);
    }

    // Shooting.
    if (mouseDown && p.mode === 'foot') {
      const origin = new THREE.Vector3(p.x, 1.4, p.z);
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const shotResult = fireWeapon(p, scene, origin, dir, shootTargets(), game.rng);
      if (shotResult.fired) {
        audio.gunshot(WEAPONS[p.weaponIndex].id === 'breacher');
        if (game.dispatch.wanted < 2) reportCrime(game.dispatch, 6, 'Shots fired');
      }
    }
    updateTracers(scene, p.tracers, dt);

    // World systems.
    updateTraffic(traffic, [hero, ...game.dispatch.units.map((u) => u.vehicle)], dt);
    const target = p.mode === 'car' ? p.vehicle : { x: p.x, z: p.z, heading: p.heading, speed: 0 };
    updateDispatch(game.dispatch, target, dt, t);
    animateOfficers(game.dispatch, t);
    particles.update(dt);
    updateCrew(game.crew, dt);
    updateDialogue(game.dialogue, dt);
    const result = updateMission(game.campaign, { x: target.x, z: target.z, wanted: game.dispatch.wanted, setWanted: (n) => setWanted(game.dispatch, n) }, dt);
    if (result === 'complete') { audio.cash(); hud.toast('JOB COMPLETE'); saveGame(1, game.career, `Job ${game.career.missionIndex + 1}`); startMission(game.campaign); }
    else if (result === 'failed') { hud.toast('JOB FAILED'); startMission(game.campaign); }
    else if (result === 'stage') sayLine(game.dialogue, game.campaign.active.giver, `Next: ${game.campaign.active.stages[game.campaign.stage]}.`);
    if (p.dead) {
      hud.toast('WASTED · hospital bill $500');
      game.career.cash = Math.max(0, game.career.cash - 500);
      p.health = 100;
      p.dead = false;
      setWanted(game.dispatch, 0);
      if (p.mode === 'car') exitVehicle(p, world);
      p.x = WORLD.safehouse.x;
      p.z = WORLD.safehouse.z;
    }

    world.setFocus(target.x, target.z);
    world.update(t, dt);
    rig.update(target, target.heading ?? p.heading, target.speed ?? 0, dt, p.mode);
    rig.yawOffset *= 1 - Math.min(1, dt * 0.8);
    audio.update({ speed: p.vehicle?.speed ?? 0, throttle: Math.max(0, forward), driving: p.mode === 'car', sirens: game.dispatch.units.some((u) => u.distance < 120), t });
  }

  function stepMenus() {
    if (game.screen === 'title' && hit('Enter', 'Space', 'KeyW', 'ArrowUp')) play();
    else if (game.screen === 'map' && hit('KeyM', 'Escape')) play();
    else if (game.screen === 'map') {
      for (let s = 1; s <= 3; s += 1) {
        if (hit(`Digit${s}`)) { saveGame(s, game.career); pause(); hud.toast(`Saved to slot ${s}`); }
        if (hit(`F${s}`)) { const loaded = loadGame(s); if (loaded) { Object.assign(game.career, loaded); pause(); } }
      }
    } else if (game.screen === 'garage') {
      if (hit('Escape', 'KeyG')) { closeGarage(); return; }
      const ids = ['repair', 'respray', 'engine', 'armor', 'tires', 'nitro'];
      let i = Math.max(0, ids.indexOf(garageSel));
      if (hit('ArrowDown', 'KeyS')) i = (i + 1) % ids.length;
      if (hit('ArrowUp', 'KeyW')) i = (i + ids.length - 1) % ids.length;
      garageSel = ids[i];
      let message = '';
      if (hit('Enter', 'Space')) { const r = purchase(game.career, garageSel, { dispatch: game.dispatch }); message = r.message; if (r.ok) audio.cash(); else audio.ui(); }
      if (pressed.size) showGarageUI(overlay, game.career, { selected: garageSel, message });
    } else if (game.screen === 'play' && hit('Escape')) pause();
  }

  // ---- Loop ------------------------------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    stepMenus();
    if (game.screen === 'play') {
      acc += dt;
      while (acc >= STEP) { step(STEP); acc -= STEP; pressed.clear(); }
      const st = audio.station;
      game.radio = { station: st.name, track: audio.track, color: st.color };
      hud.update(buildHudState(game));
      const pos = game.player.mode === 'car' ? game.player.vehicle : game.player;
      const obj = game.campaign.active ? game.campaign.targets[game.campaign.stage] : null;
      hud.drawMinimap({ x: pos.x, z: pos.z, heading: pos.heading, t: game.time, cones: true, objective: obj && obj.x !== undefined ? obj : null,
        police: game.dispatch.units.map((u) => ({ x: u.vehicle.x, z: u.vehicle.z, heading: u.vehicle.heading })),
        icons: [{ x: WORLD.garage.x, z: WORLD.garage.z, label: 'G', color: '#46e0ff' }, { x: WORLD.safehouse.x, z: WORLD.safehouse.z, label: 'H', color: '#7dff9b' }] });
    } else {
      pressed.clear();
    }
    if (game.screen === 'garage' && garage) {
      updateGarage(garage, now / 1000);
      renderer.render(garage.scene, garage.camera);
    } else {
      if (game.screen === 'title') { world.update(now / 1000, dt); rig.update(hero, 0.6 + now / 20000, 0, dt, 'car'); }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  rig.update(hero, 0, 0, 0, 'car');
  requestAnimationFrame(frame);
}
