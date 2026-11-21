// The story and progression of Palma Sol: the ten-job campaign (each job a run of staged
// objectives: reach a marker, lose the cops, survive), Ocean Drive street races, cash and respect
// ranks, the three crew abilities on Z / X / C with cooldowns, the dialogue queue the HUD shows,
// and save/load across three localStorage slots.
import { CREW, DISTRICTS, MISSIONS, NEW_GAME, WORLD, rankForRespect } from './config.js';

const SAVE_KEY = 'palma-sol-save-';

/** A fresh career (cash, respect, completed jobs, owned gear and stats). */
export function createCareer(overrides = {}) {
  return {
    ...structuredClone(NEW_GAME),
    completed: [],
    districtStanding: Object.fromEntries(DISTRICTS.map((d) => [d.id, 10])),
    car: { tune: 1, topSpeed: 0, armor: 0, grip: 0, nitro: 0, condition: 1 },
    ...overrides,
  };
}

/** Where each stage of a job takes place: derived from its district so every job crosses the map. */
function stageTargets(mission) {
  const d = DISTRICTS.find((x) => x.id === mission.district);
  const cx = Math.max(-8, Math.min(300, (d.x0 + d.x1) / 2));
  const cz = (d.z0 + d.z1) / 2;
  return [
    { type: 'goto', x: cx > 60 ? WORLD.avenueXs[0] : 4, z: cz + 30 },
    { type: 'goto', x: cx > 60 ? WORLD.avenueXs[1] : 6, z: cz - 70, heat: 2 + Math.floor(mission.id / 3) },
    { type: 'lose' },
    { type: 'goto', x: WORLD.safehouse.x - 30, z: WORLD.safehouse.z },
  ];
}

/** Create the campaign runner for a career. */
export function createCampaign(career) {
  return { career, active: null, stage: 0, timer: 0, targets: [], race: null, log: [] };
}

/** Start the career's next job (or a chosen one). */
export function startMission(c, index = c.career.missionIndex) {
  const mission = MISSIONS[Math.min(index, MISSIONS.length - 1)];
  c.active = mission;
  c.stage = 0;
  c.timer = 180 + mission.id * 12;
  c.targets = stageTargets(mission);
  return mission;
}

/** The current objective marker (or null). */
export function currentObjective(c) {
  if (!c.active) return null;
  const t = c.targets[c.stage];
  return { mission: c.active, stage: c.stage, text: c.active.stages[c.stage], next: c.active.stages[c.stage + 1] || 'Collect your cut', target: t };
}

/**
 * Advance the active job. ctx: { x, z, wanted, setWanted(n) }. Returns 'stage' | 'complete' |
 * 'failed' | null when something changed.
 */
export function updateMission(c, ctx, dt) {
  if (!c.active) return null;
  c.timer -= dt;
  if (c.timer <= 0) { c.active = null; return 'failed'; }
  const t = c.targets[c.stage];
  let done = false;
  if (t.type === 'goto') done = Math.hypot(ctx.x - t.x, ctx.z - t.z) < 9;
  else if (t.type === 'lose') done = ctx.wanted === 0;
  if (!done) return null;
  if (t.heat) ctx.setWanted(t.heat);
  c.stage += 1;
  if (c.stage >= c.targets.length) {
    completeMission(c);
    return 'complete';
  }
  return 'stage';
}

/** Pay out the job, raise respect and district standing, rate it and move the story on. */
export function completeMission(c) {
  const m = c.active;
  const career = c.career;
  const medal = c.timer > 90 ? 'gold' : 'silver';
  career.cash += m.reward;
  career.respect += 400 + m.id * 120;
  career.completed.push({ id: m.id, medal });
  career.districtStanding[m.district] = Math.min(100, (career.districtStanding[m.district] || 0) + 18);
  career.missionIndex = Math.min(MISSIONS.length - 1, career.missionIndex + 1);
  c.active = null;
  return medal;
}

/** Ocean Drive street race: eight checkpoints up the boulevard and back down the first avenue. */
export function startStreetRace(c, startZ = 200) {
  const checkpoints = [];
  for (let i = 1; i <= 5; i += 1) checkpoints.push({ x: 5, z: startZ - i * 120 });
  checkpoints.push({ x: WORLD.avenueXs[0], z: startZ - 600 });
  checkpoints.push({ x: WORLD.avenueXs[0], z: startZ - 300 });
  checkpoints.push({ x: WORLD.avenueXs[0], z: startZ });
  c.race = { checkpoints, index: 0, time: 0, best: 96 };
  return c.race;
}

/** Tick the race; returns 'checkpoint' | 'won' | 'lost' | null. */
export function updateStreetRace(c, x, z, dt) {
  const r = c.race;
  if (!r) return null;
  r.time += dt;
  const cp = r.checkpoints[r.index];
  if (Math.hypot(x - cp.x, z - cp.z) < 12) {
    r.index += 1;
    if (r.index >= r.checkpoints.length) {
      const won = r.time < r.best;
      if (won) { c.career.cash += 3000; c.career.respect += 300; c.career.stats.racesWon += 1; }
      c.race = null;
      return won ? 'won' : 'lost';
    }
    return 'checkpoint';
  }
  return null;
}

/** Respect summary for the HUD: rank, title and progress to the next rank. */
export function respectProgress(career) {
  const rank = rankForRespect(career.respect);
  const next = rankForRespect(Infinity).rank === rank.rank ? rank : { need: [0, 500, 1400, 2800, 4600, 7000, 10000][rank.rank] ?? rank.need };
  const span = Math.max(1, next.need - rank.need);
  return { rank: rank.rank, title: rank.title, progress: Math.min(1, (career.respect - rank.need) / span), respect: career.respect, nextNeed: next.need };
}

/** Story completion percentage shown on the map screen. */
export function completionPercent(career) {
  const jobs = career.completed.length / MISSIONS.length;
  const standing = Object.values(career.districtStanding).reduce((a, b) => a + b, 0) / (DISTRICTS.length * 100);
  return Math.round((jobs * 0.7 + standing * 0.3) * 1000) / 10;
}

// ---------------------------------------------------------------------------------------------
// Crew abilities

/** Cooldown state for the three crew abilities. */
export function createCrew() {
  return CREW.map((m) => ({ ...m, remaining: 0, active: 0 }));
}

/**
 * Trigger the ability bound to a key (Z, X or C). ctx exposes the dispatch and a minimap flag.
 * Returns the crew member used, or null when it is cooling down.
 */
export function useCrewAbility(crew, key, ctx) {
  const m = crew.find((c) => c.key === key);
  if (!m || m.remaining > 0) return null;
  m.remaining = m.cooldown;
  if (m.id === 'sora') { ctx.dispatch.wanted = Math.max(0, ctx.dispatch.wanted - 1); ctx.dispatch.heat = ctx.dispatch.wanted * 10; ctx.dispatch.searchTimer = 0; }
  if (m.id === 'mateo') ctx.dispatch.blackout = 8;
  if (m.id === 'nadia') m.active = 20;
  return m;
}

/** Tick crew cooldowns. */
export function updateCrew(crew, dt) {
  for (const m of crew) {
    m.remaining = Math.max(0, m.remaining - dt);
    m.active = Math.max(0, m.active - dt);
  }
}

// ---------------------------------------------------------------------------------------------
// Dialogue

/** A queue of lines shown one at a time in the dialogue box. */
export function createDialogueQueue() {
  return { lines: [], current: null, age: 0 };
}

/** Queue a line from a character id in CHARACTERS. */
export function sayLine(q, speaker, text, seconds = 5) {
  q.lines.push({ speaker, text, seconds });
}

/** Advance the queue; returns the line on screen (or null). */
export function updateDialogue(q, dt) {
  if (q.current) {
    q.age += dt;
    if (q.age >= q.current.seconds) q.current = null;
  }
  if (!q.current && q.lines.length) { q.current = q.lines.shift(); q.age = 0; }
  return q.current;
}

/** Lines the crew says when a job stage begins. */
export const STAGE_LINES = {
  1: [['luz', 'Sugar run is in the blue wagon behind the pier. Easy money, cariño.']],
  5: [['nadia', 'Couriers in the Mercado. Tag them quietly — the whole market is watching.']],
  10: [['sora', 'Every cruiser in Palma is on us! Hit the nitro and keep it on Ocean Drive!']],
};

// ---------------------------------------------------------------------------------------------
// Saves

/** Save the career into slot 1–3. */
export function saveGame(slot, career, label = '') {
  const data = { version: 1, savedAt: Date.now(), label: label || `Job ${career.missionIndex + 1}`, career };
  try { localStorage.setItem(SAVE_KEY + slot, JSON.stringify(data)); return true; } catch { return false; }
}

/** Load the career in slot 1–3 (or null). */
export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(SAVE_KEY + slot);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return createCareer(data.career);
  } catch { return null; }
}

/** Summaries of the three slots for the save screen. */
export function listSaves() {
  const out = [];
  for (let slot = 1; slot <= 3; slot += 1) {
    let info = null;
    try { const raw = localStorage.getItem(SAVE_KEY + slot); if (raw) info = JSON.parse(raw); } catch { info = null; }
    out.push({ slot, empty: !info, label: info?.label, cash: info?.career?.cash, completed: info?.career?.completed?.length || 0, savedAt: info?.savedAt });
  }
  return out;
}
