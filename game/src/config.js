// PALMA SOL: Neon Coast — game data and tuning. Every name, district, character, car, station
// and story beat here is original to Palma Sol. Other modules read these tables; nothing here
// touches the DOM or three.js, so the whole design of the game can be read in one place.

/** World layout (metres). The coast runs north–south along Z; the ocean lies west (−X). */
export const WORLD = {
  minZ: -560,
  maxZ: 560,
  oceanEdgeX: -56,
  beachInnerX: -24,
  promenadeX: -14,
  boulevardHalfWidth: 11,
  cityMaxX: 330,
  avenueXs: [118, 222, 318],
  streetZs: [-480, -360, -240, -120, 0, 120, 240, 360, 480],
  avenueWidth: 14,
  streetWidth: 13,
  garage: { x: 140, z: 60 },
  safehouse: { x: 40, z: 300 },
};

/** The six districts of Palma Sol, each a rectangle on the city map with its own colour. */
export const DISTRICTS = [
  { id: 'playa', name: 'PLAYA DORADA', street: 'Ocean Drive', color: '#ff9f5a', x0: -74, x1: 118, z0: -240, z1: 120, standing: 82 },
  { id: 'mercado', name: 'NEON MERCADO', street: 'Calle Farol', color: '#ff4fd8', x0: -74, x1: 118, z0: 120, z1: 560, standing: 64 },
  { id: 'porto', name: 'PORTO VIEJO', street: 'Dockside Row', color: '#4fc3ff', x0: -74, x1: 118, z0: -560, z1: -240, standing: 41 },
  { id: 'palmera', name: 'PALMERA HILLS', street: 'Avenida Palmera', color: '#b58cff', x0: 118, x1: 222, z0: -560, z1: 560, standing: 48 },
  { id: 'solar', name: 'SOLAR CENTRO', street: 'Avenida Sol', color: '#ffd84f', x0: 118, x1: 222, z0: -240, z1: 240, standing: 57 },
  { id: 'coral', name: 'CORAL HEIGHTS', street: 'Mirador Way', color: '#5cf2b0', x0: 222, x1: 330, z0: -560, z1: 560, standing: 33 },
];

/** Vehicle classes: top speed (km/h), acceleration (m/s²), grip and armour on a 0–1 scale. */
export const VEHICLES = {
  solara: { name: 'SOLARA GT', kind: 'sports', topSpeed: 236, accel: 15, grip: 0.86, armor: 0.42, color: 0xff4a3d, tune: 3 },
  cruiser: { name: 'PSPD INTERCEPTOR', kind: 'police', topSpeed: 214, accel: 12, grip: 0.8, armor: 0.7, color: 0xf4f6fa },
  cab: { name: 'PALMA CAB', kind: 'sedan', topSpeed: 168, accel: 9, grip: 0.74, armor: 0.5, color: 0xffc23a },
  coupe: { name: 'MARE COUPE', kind: 'sedan', topSpeed: 182, accel: 10, grip: 0.76, armor: 0.45, color: 0x58d6c9 },
  wagon: { name: 'BRISEÑO WAGON', kind: 'sedan', topSpeed: 158, accel: 8, grip: 0.7, armor: 0.55, color: 0xf2e1c4 },
  scooter: { name: 'VESPINA 50', kind: 'scooter', topSpeed: 92, accel: 7, grip: 0.9, armor: 0.1, color: 0x7fe0ff },
};

/** Civilian paint colours used by traffic: sun-faded pastels and a few loud ones. */
export const TRAFFIC_COLORS = [0x58d6c9, 0xf7b7c8, 0xf2e1c4, 0xffc23a, 0x9bd2ff, 0xffffff, 0xb58cff, 0x2f3b52, 0xff8b5c];

/** Weapon slots 1–6 on the weapon bar. damage per hit, rate in shots per second. */
export const WEAPONS = [
  { slot: 1, id: 'fists', name: 'FISTS', ammo: Infinity, clip: Infinity, damage: 12, rate: 2.5, range: 2.2, spread: 0 },
  { slot: 2, id: 'nine', name: '9MM', ammo: 84, clip: 15, damage: 22, rate: 4, range: 60, spread: 0.02 },
  { slot: 3, id: 'viper', name: 'VIPER SMG', ammo: 240, clip: 40, damage: 16, rate: 12, range: 55, spread: 0.05 },
  { slot: 4, id: 'breacher', name: 'BREACHER', ammo: 36, clip: 8, damage: 14, rate: 1.4, range: 22, spread: 0.12, pellets: 7 },
  { slot: 5, id: 'carbine', name: 'CARBINE', ammo: 180, clip: 30, damage: 30, rate: 8, range: 95, spread: 0.015 },
  { slot: 6, id: 'flare', name: 'FLARE', ammo: 6, clip: 1, damage: 80, rate: 0.8, range: 70, spread: 0, explosive: true },
];

/** The crew: each member brings one ability bound to Z, X or C. cooldown in seconds. */
export const CREW = [
  { key: 'Z', id: 'sora', name: 'Sora Vega', role: 'Getaway Driver', ability: 'CLEAN BREAK', effect: 'Drops one wanted star and scrambles pursuit', cooldown: 90, skin: '#c98e62', hair: '#1b1420', hairStyle: 'bob', accent: '#ff7a59', shirt: '#ff5d73' },
  { key: 'X', id: 'mateo', name: 'Mateo Cruz', role: 'Hacker', ability: 'BLACKOUT', effect: 'Kills traffic lights and police radios for 8 s', cooldown: 60, skin: '#8a5a3c', hair: '#0d0d12', hairStyle: 'fade', accent: '#46e0ff', shirt: '#2f6bff' },
  { key: 'C', id: 'nadia', name: 'Nadia Vance', role: 'Lookout', ability: 'EYES UP', effect: 'Marks every unit and sight cone on the minimap', cooldown: 45, skin: '#f0c7a2', hair: '#c9562f', hairStyle: 'long', accent: '#7dff9b', shirt: '#14b88a' },
];

/** Story characters who speak in the dialogue box. */
export const CHARACTERS = {
  sora: { name: 'Sora Vega', role: 'CREW · GETAWAY DRIVER', skin: '#c98e62', hair: '#1b1420', hairStyle: 'bob', shirt: '#ff5d73', accent: '#ff7a59' },
  mateo: { name: 'Mateo Cruz', role: 'CREW · HACKER', skin: '#8a5a3c', hair: '#0d0d12', hairStyle: 'fade', shirt: '#2f6bff', accent: '#46e0ff' },
  nadia: { name: 'Nadia Vance', role: 'CREW · LOOKOUT', skin: '#f0c7a2', hair: '#c9562f', hairStyle: 'long', shirt: '#14b88a', accent: '#7dff9b' },
  rico: { name: 'Rico Delgado', role: 'MECHANIC · CHROME & TORQUE', skin: '#b67a52', hair: '#2a1d16', hairStyle: 'cap', shirt: '#3a4659', accent: '#ffb02e' },
  luz: { name: 'Luz Marín', role: 'FIXER · CASA LUZ', skin: '#e2a982', hair: '#3b1f2b', hairStyle: 'bun', shirt: '#ffcf5a', accent: '#ffcf5a' },
  dispatch: { name: 'PSPD Dispatch', role: 'PALMA SOL POLICE', skin: '#d9a47e', hair: '#22252e', hairStyle: 'cap', shirt: '#1d3b7a', accent: '#4f8bff' },
};

/** The ten-job story campaign. stages are the objective lines shown on the mission card. */
export const MISSIONS = [
  { id: 1, title: 'SALT & SUGAR', giver: 'luz', district: 'playa', reward: 2500, stages: ['Meet Luz at Casa Luz', 'Pick up the sugar run', 'Lose the tail', 'Deliver to Dockside Row'], medal: 'gold' },
  { id: 2, title: 'TIDE MONEY', giver: 'luz', district: 'porto', reward: 4200, stages: ['Reach the Porto Viejo pier', 'Grab the cash cases', 'Outrun the harbour patrol', 'Stash the cash'], medal: 'gold' },
  { id: 3, title: 'PINK SLIPS', giver: 'sora', district: 'playa', reward: 5000, stages: ['Join the race on Ocean Drive', 'Hit every checkpoint', 'Finish first', 'Keep the Solara GT'], medal: 'gold' },
  { id: 4, title: 'GHOST SIGNAL', giver: 'mateo', district: 'solar', reward: 6500, stages: ['Plant the relay on Avenida Sol', 'Hold the roof for 60 s', 'Escape the tower', 'Return to the safehouse'], medal: 'silver' },
  { id: 5, title: 'NIGHT MARKET', giver: 'nadia', district: 'mercado', reward: 7200, stages: ['Scout Neon Mercado', 'Tag the cartel couriers', 'Survive the ambush', 'Steal a Palma Cab out'], medal: 'gold' },
  { id: 6, title: 'CORAL CROWN', giver: 'luz', district: 'coral', reward: 9000, stages: ['Crash the gala in Coral Heights', 'Lift the crown', 'Break the lockdown', 'Fence it at the docks'], medal: 'silver' },
  { id: 7, title: 'DRY DOCK', giver: 'sora', district: 'porto', reward: 9800, stages: ['Steal the armoured hauler', 'Strip the tracker', 'Shake the cruisers', 'Drop it at Chrome & Torque'], medal: 'gold' },
  { id: 8, title: 'PALM SUNDAY', giver: 'mateo', district: 'palmera', reward: 11500, stages: ['Blackout Palmera Hills', 'Empty the vault', 'Hold off PSPD', 'Fly out with Air-free skies'], medal: 'silver' },
  { id: 9, title: 'LAST LIGHT', giver: 'nadia', district: 'mercado', reward: 13000, stages: ['Find the informant', 'Escort her through the market', 'Clear the waterfront', 'Get her on the boat'], medal: 'gold' },
  { id: 10, title: 'SOLAR ECLIPSE', giver: 'sora', district: 'playa', reward: 25000, stages: ['Rob the Eclipse casino', 'Grab the getaway car', 'Outrun all of PSPD on Ocean Drive', 'Reach the marina before dusk'], medal: null },
];

/** Respect ranks: total respect needed for each title. */
export const RESPECT_RANKS = [
  { rank: 1, title: 'NOBODY', need: 0 },
  { rank: 2, title: 'CORNER KID', need: 500 },
  { rank: 3, title: 'RUNNER', need: 1400 },
  { rank: 4, title: 'HUSTLER', need: 2800 },
  { rank: 5, title: 'SHOT CALLER', need: 4600 },
  { rank: 6, title: 'KINGPIN', need: 7000 },
  { rank: 7, title: 'LEGEND OF PALMA', need: 10000 },
];

/** In-world radio stations. Each has a key, tempo and tracks the procedural synth plays. */
export const RADIO_STATIONS = [
  { id: 'solar', name: 'SOLAR 104.5 FM', color: '#ff9f5a', bpm: 112, root: 45, scale: [0, 3, 5, 7, 10], tracks: ['Sunset Overdrive', 'Coral Static', 'Chrome Lagoon'], dj: 'DJ Paloma' },
  { id: 'neon', name: 'NEON TIDE 98.1', color: '#ff4fd8', bpm: 124, root: 48, scale: [0, 2, 3, 7, 8], tracks: ['Midnight Mercado', 'Magenta Waves', 'Afterglow Run'], dj: 'Vex' },
  { id: 'brisa', name: 'BRISA LATINA 91.3', color: '#5cf2b0', bpm: 98, root: 50, scale: [0, 2, 4, 7, 9], tracks: ['Mar de Oro', 'Calle Farol', 'Palmera Dulce'], dj: 'Tía Carmen' },
];

/** Upgrades sold at Chrome & Torque Customs. stat changes are applied to the player's car. */
export const GARAGE_UPGRADES = [
  { id: 'repair', name: 'Full Repair', price: 350, stat: 'condition', amount: 100, desc: 'Body, glass and tyres like new' },
  { id: 'respray', name: 'Respray · Sunset Coral', price: 600, stat: 'heat', amount: -1, desc: 'Fresh paint clears 1 wanted star' },
  { id: 'engine', name: 'Stage 3 Engine', price: 8500, stat: 'topSpeed', amount: 18, desc: '+18 km/h top speed, +12% torque' },
  { id: 'armor', name: 'Armor Plating', price: 6200, stat: 'armor', amount: 0.25, desc: 'Ballistic panels, run-flat rims' },
  { id: 'tires', name: 'Grip Tires', price: 2400, stat: 'grip', amount: 0.08, desc: 'Track compound, sharper turn-in' },
  { id: 'nitro', name: 'Nitro Kit', price: 4800, stat: 'nitro', amount: 1, desc: 'Twin cyan-flame shots, refills' },
];

/** Weapons and gear sold at the counter. */
export const GARAGE_WEAPONS = [
  { id: 'viper', name: 'Viper SMG', price: 3200, owned: true },
  { id: 'breacher', name: 'Breacher Shotgun', price: 4100, owned: true },
  { id: 'carbine', name: 'Carbine Rifle', price: 7800, owned: true },
  { id: 'flare', name: 'Flare Launcher', price: 5600, owned: false },
  { id: 'vest', name: 'Body Armor', price: 1200, owned: false },
  { id: 'ammo', name: 'Ammo Crate', price: 400, owned: false },
];

/** Police tuning: unit counts per star level and the tactics dispatch assigns. */
export const POLICE = {
  unitsPerStar: [0, 2, 3, 5, 7, 9],
  helicopterFromStar: 3,
  roadblockFromStar: 4,
  sightRange: 120,
  searchSecondsPerStar: 9,
  callsigns: ['MARLIN', 'VIPER', 'REEF', 'HAMMER', 'GULL', 'TARPON', 'ORCA', 'PELICAN', 'BARRA'],
  tactics: ['RAMMING', 'FIRING', 'FLANKING', 'ROADBLOCK', 'PURSUIT'],
  tacticColors: { SPOTLIGHT: '#3f8cff', RAMMING: '#ff3b5c', FIRING: '#ff8a1f', FLANKING: '#ffd23f', ROADBLOCK: '#b06bff', PURSUIT: '#38d39f', SEARCHING: '#7c8aa5' },
};

/** Driving model constants shared by every car. */
export const DRIVING = {
  step: 1 / 60,
  steerRate: 2.4,
  maxSteer: 0.6,
  dragCoefficient: 0.0009,
  rollingResistance: 1.4,
  brakeForce: 26,
  handbrakeGripScale: 0.32,
  nitroBoost: 1.55,
  nitroDrainPerSec: 0.16,
  nitroRefillPerSec: 0.035,
};

/** Player-on-foot constants. */
export const ON_FOOT = { walkSpeed: 4.2, runSpeed: 7.4, turnRate: 9, enterCarRange: 4.2, maxHealth: 100, maxArmor: 100 };

/** Starting career state for a new game (the shots stage a late-game save instead). */
export const NEW_GAME = {
  cash: 1500,
  respect: 0,
  missionIndex: 0,
  health: 100,
  armor: 0,
  weapons: ['fists', 'nine'],
  upgrades: [],
  stats: { distanceKm: 0, copsEvaded: 0, carsStolen: 0, headshots: 0, racesWon: 0, playMinutes: 0 },
};

/** Deterministic pseudo-random numbers (mulberry32): the same seed always builds the same city. */
export function createSeededRandom(seed) {
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
  return next;
}

/** The district a world position falls in (the last match wins, so coast districts override). */
export function districtAt(x, z) {
  let found = DISTRICTS[0];
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) found = d;
  return found;
}

/** Respect rank record for a respect total. */
export function rankForRespect(respect) {
  let current = RESPECT_RANKS[0];
  for (const r of RESPECT_RANKS) if (respect >= r.need) current = r;
  return current;
}
