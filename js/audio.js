/**
 * Project Let Go — The Clearing
 * Phase 6: Unified Layered Ambience & Soft Night Music (Pure Web Audio API)
 *
 * Starts OFF to respect browser autoplay rules. Visitors can open the subtle
 * bottom-right sound popover (or press 'M') to toggle & adjust:
 *  - Campsite ambience (campfire crackle, lake lapping, soft wind, crickets, distant owl)
 *  - Soft night music (warm sparse minor ambient chords)
 */

(function () {
  'use strict';

  const toggleBtn = document.getElementById('audio-toggle');
  const popover = document.getElementById('sound-popover');
  const ambCheck = document.getElementById('amb-on');
  const ambVol = document.getElementById('amb-vol');
  const musCheck = document.getElementById('mus-on');
  const musVol = document.getElementById('mus-vol');

  if (!toggleBtn || !popover) return;

  let ctx = null;
  let ambGain = null;
  let musGain = null;
  let ambOn = false;
  let musOn = false;
  let ritualPhase = 'writing';
  let padTimer = 0;
  let crackleTimer = 0;
  let cricketTimer = 0;
  let owlTimer = 0;
  let chordIndex = 0;

  const CHORDS = [
    [45, 52, 57, 60], // Am
    [41, 48, 52, 57], // Fmaj7
    [48, 55, 59, 64], // Cmaj7
    [40, 47, 52, 59], // Em
  ];

  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function makeWarmNoise(audioCtx, secs) {
    const len = audioCtx.sampleRate * secs;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.04 * w) / 1.04;
      last = data[i];
      data[i] *= 2.5;
    }
    return buf;
  }

  function makeWhiteNoise(audioCtx, secs) {
    const len = audioCtx.sampleRate * secs;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function ensureGraph() {
    if (ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    ctx = new AudioCtx();
    ambGain = ctx.createGain();
    ambGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    ambGain.connect(ctx.destination);

    musGain = ctx.createGain();
    musGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    musGain.connect(ctx.destination);

    const warmNoise = makeWarmNoise(ctx, 4);
    const whiteNoise = makeWhiteNoise(ctx, 2);

    // 1. Campfire hearth rumble
    const fireSrc = ctx.createBufferSource();
    fireSrc.buffer = warmNoise;
    fireSrc.loop = true;
    const fireF = ctx.createBiquadFilter();
    fireF.type = 'lowpass';
    fireF.frequency.value = 210;
    const fireG = ctx.createGain();
    fireG.gain.value = 0.32;
    fireSrc.connect(fireF).connect(fireG).connect(ambGain);
    fireSrc.start();

    // 2. Gentle lake water lapping
    const lakeSrc = ctx.createBufferSource();
    lakeSrc.buffer = warmNoise;
    lakeSrc.loop = true;
    const lakeF = ctx.createBiquadFilter();
    lakeF.type = 'bandpass';
    lakeF.frequency.value = 380;
    lakeF.Q.value = 1.1;
    const lakeG = ctx.createGain();
    lakeG.gain.value = 0.08;
    const lakeLfo = ctx.createOscillator();
    lakeLfo.frequency.value = 0.14;
    const lakeD = ctx.createGain();
    lakeD.gain.value = 0.038;
    lakeLfo.connect(lakeD).connect(lakeG.gain);
    lakeLfo.start();
    lakeSrc.connect(lakeF).connect(lakeG).connect(ambGain);
    lakeSrc.start();

    // 3. Soft forest breeze
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = warmNoise;
    windSrc.loop = true;
    const windF = ctx.createBiquadFilter();
    windF.type = 'bandpass';
    windF.frequency.value = 620;
    windF.Q.value = 2.4;
    const windG = ctx.createGain();
    windG.gain.value = 0.03;
    windSrc.connect(windF).connect(windG).connect(ambGain);
    windSrc.start();

    // 4. Organic campfire crackles
    function scheduleCrackle() {
      if (ctx && ambOn && !document.hidden) {
        const now = ctx.currentTime;
        const pop = ctx.createBufferSource();
        pop.buffer = whiteNoise;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1600 + Math.random() * 2800, now);
        bp.Q.value = 2.8;
        const g = ctx.createGain();
        const boost = ritualPhase === 'burning' ? 1.65 : 1.0;
        const dur = 0.014 + Math.random() * 0.025;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime((0.035 + Math.random() * 0.075) * boost, now + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        pop.connect(bp).connect(g).connect(ambGain);
        pop.start(now, Math.random() * 1.4, dur + 0.01);
      }
      crackleTimer = window.setTimeout(scheduleCrackle, ritualPhase === 'burning' ? (90 + Math.random() * 260) : (160 + Math.random() * 620));
    }
    scheduleCrackle();

    // 5. Distant night crickets
    function scheduleCricket() {
      if (ctx && ambOn && !document.hidden && ritualPhase !== 'burning') {
        const now = ctx.currentTime;
        const chirps = 2 + Math.floor(Math.random() * 3);
        const f = 4080 + Math.random() * 340;
        for (let i = 0; i < chirps; i++) {
          const t0 = now + i * 0.14;
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t0);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.013, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.095);
          osc.connect(g).connect(ambGain);
          osc.start(t0);
          osc.stop(t0 + 0.11);
        }
      }
      cricketTimer = window.setTimeout(scheduleCricket, 2600 + Math.random() * 4800);
    }
    scheduleCricket();

    // 6. Rare distant owl
    function scheduleOwl() {
      if (ctx && ambOn && !document.hidden && ritualPhase === 'campsite') {
        const now = ctx.currentTime;
        [
          { s: 0.0, d: 0.34, f0: 410, f1: 385, v: 0.018 },
          { s: 0.52, d: 0.62, f0: 395, f1: 342, v: 0.022 }
        ].forEach((n) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(n.f0, now + n.s);
          osc.frequency.exponentialRampToValueAtTime(n.f1, now + n.s + n.d);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 650;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, now + n.s);
          g.gain.linearRampToValueAtTime(n.v, now + n.s + 0.09);
          g.gain.exponentialRampToValueAtTime(0.0001, now + n.s + n.d);
          osc.connect(lp).connect(g).connect(ambGain);
          osc.start(now + n.s);
          osc.stop(now + n.s + n.d + 0.05);
        });
      }
      owlTimer = window.setTimeout(scheduleOwl, 26000 + Math.random() * 30000);
    }
    owlTimer = window.setTimeout(scheduleOwl, 14000 + Math.random() * 14000);

    // 7. Soft ambient music pad
    function schedulePad() {
      if (ctx && musOn && !document.hidden) {
        const now = ctx.currentTime + 0.05;
        const chord = CHORDS[chordIndex % CHORDS.length];
        chordIndex++;
        const dur = 10.5;
        chord.forEach((m) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(midiHz(m), now);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 680;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.022, now + 3.2);
          g.gain.linearRampToValueAtTime(0.018, now + dur - 3.2);
          g.gain.linearRampToValueAtTime(0.0001, now + dur);
          osc.connect(lp).connect(g).connect(musGain);
          osc.start(now);
          osc.stop(now + dur + 0.1);
        });
      }
      padTimer = window.setTimeout(schedulePad, 9600);
    }
    schedulePad();

    return true;
  }

  function applyGains(fadeSec) {
    if (!ctx || !ambGain || !musGain) return;
    const now = ctx.currentTime;
    const phaseAmbScale = ritualPhase === 'journey' || ritualPhase === 'final' ? 0.35 : (ritualPhase === 'burning' ? 1.15 : 1.0);
    const targetAmb = (ambOn && !document.hidden) ? Math.max(0.0001, (Number(ambVol.value) / 100) * 0.85 * phaseAmbScale) : 0.0001;
    const targetMus = (musOn && !document.hidden) ? Math.max(0.0001, (Number(musVol.value) / 100) * 0.9) : 0.0001;

    ambGain.gain.cancelScheduledValues(now);
    ambGain.gain.setValueAtTime(Math.max(0.0001, ambGain.gain.value), now);
    ambGain.gain.linearRampToValueAtTime(targetAmb, now + fadeSec);

    musGain.gain.cancelScheduledValues(now);
    musGain.gain.setValueAtTime(Math.max(0.0001, musGain.gain.value), now);
    musGain.gain.linearRampToValueAtTime(targetMus, now + fadeSec);
  }

  function syncUI() {
    const anyOn = ambOn || musOn;
    toggleBtn.classList.toggle('is-active', anyOn);
    toggleBtn.setAttribute('aria-pressed', String(anyOn));
    ambCheck.checked = ambOn;
    musCheck.checked = musOn;
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = popover.hidden;
    popover.hidden = !opening;
    toggleBtn.setAttribute('aria-expanded', String(opening));
    // If opening for the very first time and both are off, gently enable ambience so 1 click works intuitively
    if (opening && !ambOn && !musOn) {
      if (ensureGraph()) {
        if (ctx.state === 'suspended') ctx.resume();
        ambOn = true;
        applyGains(2.2);
        syncUI();
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!popover.hidden && !popover.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
      popover.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  ambCheck.addEventListener('change', () => {
    if (ambCheck.checked && !ensureGraph()) return;
    if (ctx && ctx.state === 'suspended') ctx.resume();
    ambOn = ambCheck.checked;
    applyGains(ambOn ? 2.0 : 0.9);
    syncUI();
  });

  musCheck.addEventListener('change', () => {
    if (musCheck.checked && !ensureGraph()) return;
    if (ctx && ctx.state === 'suspended') ctx.resume();
    musOn = musCheck.checked;
    applyGains(musOn ? 2.2 : 1.0);
    syncUI();
  });

  ambVol.addEventListener('input', () => applyGains(0.15));
  musVol.addEventListener('input', () => applyGains(0.15));

  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
    if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!ambOn && !musOn) {
        if (!ensureGraph()) return;
        if (ctx.state === 'suspended') ctx.resume();
        ambOn = true;
      } else {
        ambOn = false;
        musOn = false;
      }
      applyGains(ambOn ? 2.0 : 0.9);
      syncUI();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (!document.hidden && (ambOn || musOn) && ctx.state === 'suspended') ctx.resume();
    applyGains(document.hidden ? 0.5 : 1.4);
  });

  window.LetGoAudio = {
    setPhase: function (p) {
      ritualPhase = p;
      applyGains(1.8);
    }
  };

  syncUI();
})();
