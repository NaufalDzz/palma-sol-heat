// Sound for Palma Sol, synthesised live with the Web Audio API (no audio files): an engine note
// that follows speed, a two-tone PSPD siren, gunshots, explosions, UI blips, and three in-world
// radio stations whose synthwave / latin tracks are sequenced from each station's key and tempo.
import { RADIO_STATIONS } from './config.js';

/** Create the audio engine. It stays silent until resume() is called from a user gesture. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let siren = null;
  let radioGain = null;
  let noiseBuffer = null;
  let station = 0;
  let nextBeat = 0;
  let beat = 0;
  let radioOn = true;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    // Engine: two detuned saws through a low-pass.
    const eg = ctx.createGain();
    eg.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(master);
    o1.start(); o2.start();
    engine = { gain: eg, o1, o2, lp };
    // Siren: a triangle swept by an LFO.
    const sg = ctx.createGain();
    sg.gain.value = 0;
    const so = ctx.createOscillator();
    so.type = 'triangle';
    so.frequency.value = 700;
    so.connect(sg); sg.connect(master);
    so.start();
    siren = { gain: sg, osc: so };
    radioGain = ctx.createGain();
    radioGain.gain.value = 0.22;
    radioGain.connect(master);
    nextBeat = ctx.currentTime + 0.1;
  }

  function tone(freq, start, dur, type = 'sine', vol = 0.2, dest = master) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest);
    o.start(start); o.stop(start + dur + 0.05);
  }

  function noise(start, dur, vol, freq, dest = master) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(start); src.stop(start + dur);
  }

  /** Sequence the radio one beat ahead: kick, hats, bass and an arpeggio in the station's scale. */
  function scheduleRadio() {
    if (!radioOn) return;
    const st = RADIO_STATIONS[station];
    const spb = 60 / st.bpm / 2;
    while (nextBeat < ctx.currentTime + 0.25) {
      const step = beat % 16;
      const bar = Math.floor(beat / 16) % 4;
      const chord = [0, 3, 4, 2][bar];
      const midi = (n) => 440 * 2 ** ((n - 69) / 12);
      if (step % 4 === 0) { tone(110, nextBeat, 0.18, 'sine', 0.5, radioGain); tone(55, nextBeat, 0.25, 'sine', 0.4, radioGain); }
      if (step % 2 === 1) noise(nextBeat, 0.05, 0.12, 9000, radioGain);
      if (step % 8 === 4) noise(nextBeat, 0.15, 0.25, 2500, radioGain);
      if (step % 2 === 0) tone(midi(st.root - 12 + st.scale[chord % st.scale.length]), nextBeat, spb * 1.8, 'sawtooth', 0.09, radioGain);
      const arp = st.scale[(step + chord) % st.scale.length] + (step % 3 === 0 ? 12 : 0);
      tone(midi(st.root + 12 + arp), nextBeat, spb * 0.9, 'square', 0.035, radioGain);
      nextBeat += spb;
      beat += 1;
    }
  }

  return {
    get station() { return RADIO_STATIONS[station]; },
    get track() { const st = RADIO_STATIONS[station]; return st.tracks[Math.floor(beat / 128) % st.tracks.length]; },
    resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    /** Per-frame update: engine pitch from speed and throttle, siren when cops are near, radio. */
    update({ speed = 0, throttle = 0, driving = false, sirens = false, t = 0 }) {
      if (!ctx) return;
      const now = ctx.currentTime;
      const rpm = 60 + Math.abs(speed) * 3.2 + throttle * 30;
      engine.o1.frequency.setTargetAtTime(rpm, now, 0.05);
      engine.o2.frequency.setTargetAtTime(rpm * 0.501, now, 0.05);
      engine.lp.frequency.setTargetAtTime(400 + Math.abs(speed) * 25 + throttle * 600, now, 0.05);
      engine.gain.gain.setTargetAtTime(driving ? 0.06 + throttle * 0.05 : 0, now, 0.1);
      siren.osc.frequency.setTargetAtTime(Math.sin(t * 5) > 0 ? 960 : 720, now, 0.04);
      siren.gain.gain.setTargetAtTime(sirens ? 0.035 : 0, now, 0.2);
      scheduleRadio();
    },
    gunshot(heavy = false) { if (!ctx) return; const n = ctx.currentTime; noise(n, heavy ? 0.35 : 0.14, heavy ? 0.7 : 0.45, heavy ? 1800 : 3500); tone(heavy ? 90 : 160, n, 0.1, 'square', 0.15); },
    explosion() { if (!ctx) return; const n = ctx.currentTime; noise(n, 1.4, 0.9, 700); tone(48, n, 1.0, 'sine', 0.6); },
    crash() { if (!ctx) return; noise(ctx.currentTime, 0.4, 0.5, 1200); },
    ui() { if (!ctx) return; tone(880, ctx.currentTime, 0.08, 'square', 0.08); tone(1320, ctx.currentTime + 0.05, 0.08, 'square', 0.06); },
    cash() { if (!ctx) return; [0, 4, 7, 12].forEach((s, i) => tone(660 * 2 ** (s / 12), ctx.currentTime + i * 0.06, 0.15, 'triangle', 0.1)); },
    nextStation() { station = (station + 1) % RADIO_STATIONS.length; radioOn = true; beat = 0; return RADIO_STATIONS[station]; },
    toggleRadio() { radioOn = !radioOn; return radioOn; },
  };
}
