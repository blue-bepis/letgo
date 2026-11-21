/* =====================================================================
   LET GO — audio.js
   All the sound: music, fire crackle, and the little sound control.

   IMPORTANT — PLACEHOLDER SOUND
   Until you have your own music, the two tracks and the crackle are
   *made live in the browser* (no audio files at all). They're simple,
   soft stand-ins. When you have your own recordings, the only part of
   this file that changes is where the tracks come from (see the
   TRACKS section below) — the buttons, volumes and fades stay as they are.

   RULES THIS FILE FOLLOWS
   - Sound is OFF until the visitor turns it on. Nothing plays by surprise.
   - It never touches the letter, never uses storage, never uses the network.
   - If sound can't start, the rest of LET GO works fine in silence.
   ===================================================================== */
(function () {
  'use strict';

  var AudioCtx = window.AudioContext || window.webkitAudioContext;

  var wrapper = document.getElementById('sound');
  var button = document.getElementById('sound-button');
  var panel = document.getElementById('sound-panel');
  var musicToggle = document.getElementById('music-on');
  var musicSlider = document.getElementById('music-volume');
  var fxToggle = document.getElementById('fx-on');
  var fxSlider = document.getElementById('fx-volume');
  var statusLine = document.getElementById('sound-status');

  // The rest of the app talks to sound only through this tiny object.
  var api = { setPhase: function () {} };
  window.LetGoAudio = api;

  if (!wrapper || !button || !panel || !musicToggle || !musicSlider || !fxToggle || !fxSlider) { return; }
  if (!AudioCtx) {            // very old browser: remove the control rather than show a dead button
    wrapper.parentNode.removeChild(wrapper);
    return;
  }

  /* ------------------------------------------------------------------
     SETTINGS YOU MAY WANT TO TWEAK
     ------------------------------------------------------------------ */

  // How loud each layer is in each part of the experience (0 = silent, 1 = full).
  // "time" = how many seconds the fade between levels takes.
  var PHASES = {
    writing: { writing: 1, burning: 0, crackle: 0.3,  time: 2 },   // quiet, reflective
    burning: { writing: 0, burning: 1, crackle: 1,    time: 2 },   // (used in Phase 3)
    sky:     { writing: 0, burning: 0, crackle: 0.15, time: 6 },   // (used in Phase 3) fade toward silence
    final:   { writing: 0, burning: 0, crackle: 0.12, time: 4 }
  };

  // The two placeholder tracks. Each is a slow chord loop (numbers are piano
  // notes: 60 = middle C) with a few soft high notes sprinkled on top.
  var TRACKS = {
    writing: {                 // A minor — soft, sparse
      seconds: 12, peak: 0.09, cutoff: 900,
      chords: [[45, 52, 57, 60], [41, 48, 52, 57], [48, 55, 62, 64], [40, 47, 55, 62]],
      bells: [69, 72, 74, 76, 79]
    },
    burning: {                 // D minor — a little fuller, for the fire
      seconds: 10, peak: 0.12, cutoff: 1300,
      chords: [[38, 50, 57, 62], [46, 53, 57, 62], [43, 50, 55, 58], [45, 52, 57, 61]],
      bells: [74, 77, 79, 81, 84]
    }
  };

  /* ------------------------------------------------------------------
     STATE
     ------------------------------------------------------------------ */
  var ctx = null;                      // created only when the visitor first turns sound on
  var musicBus, fxBus, writingGain, burningGain, crackleLevel;
  var pads = {};
  var musicOn = false, fxOn = false;
  var musicVol = 0.6, fxVol = 0.6;
  var phase = 'writing';

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /* ------------------------------------------------------------------
     A "pad": plays a slow loop of soft chords (the placeholder music)
     ------------------------------------------------------------------ */
  function Pad(spec, destination) {
    this.spec = spec;
    this.dest = destination;
    this.index = 0;
    this.timer = null;
    this.stopTimer = null;
    this.running = false;
    this.voices = [];
  }

  Pad.prototype.start = function () {
    if (this.running) { return; }
    this.running = true;
    this.next();
  };

  Pad.prototype.next = function () {
    if (!this.running) { return; }
    var self = this, spec = this.spec;
    try {
      var chord = spec.chords[this.index % spec.chords.length];
      this.index++;
      var now = ctx.currentTime + 0.05;
      var peak = spec.peak / chord.length;
      chord.forEach(function (midi) { self.note(hz(midi), now, spec.seconds, peak, spec.cutoff); });

      var bellCount = Math.floor(Math.random() * 3);          // 0, 1 or 2 soft high notes
      for (var i = 0; i < bellCount; i++) {
        var m = spec.bells[Math.floor(Math.random() * spec.bells.length)];
        this.bell(hz(m), now + 2 + Math.random() * (spec.seconds - 4));
      }
    } catch (e) { /* a missed chord is fine */ }
    this.timer = setTimeout(function () { self.next(); }, spec.seconds * 1000);
  };

  // One chord note: two slightly-detuned soft waves, fading in slowly and out slowly.
  Pad.prototype.note = function (freq, start, dur, peak, cutoff) {
    var self = this;
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 3);
    gain.gain.setValueAtTime(peak, start + dur);
    gain.gain.setTargetAtTime(0, start + dur, 1.6);
    gain.connect(filter);
    filter.connect(this.dest);
    [-5, 5].forEach(function (cents) {
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = cents;
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + dur + 9);
      self.keep(osc, gain);
    });
  };

  // One soft high note that rings and fades.
  Pad.prototype.bell = function (freq, start) {
    var gain = ctx.createGain();
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.03, start + 0.05);
    gain.gain.setTargetAtTime(0, start + 0.06, 1.2);
    osc.connect(gain);
    gain.connect(this.dest);
    osc.start(start);
    osc.stop(start + 8);
    this.keep(osc, gain);
  };

  Pad.prototype.keep = function (osc, gain) {
    var self = this, entry = { osc: osc, gain: gain };
    this.voices.push(entry);
    osc.onended = function () {
      self.voices = self.voices.filter(function (v) { return v !== entry; });
    };
  };

  Pad.prototype.stop = function () {
    this.running = false;
    clearTimeout(this.timer);
    this.timer = null;
    var now = ctx.currentTime;
    this.voices.forEach(function (v) {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setTargetAtTime(0, now, 0.25);
        v.osc.stop(now + 1.5);
      } catch (e) { /* already stopped */ }
    });
  };

  /* ------------------------------------------------------------------
     The placeholder fire crackle: 10 seconds of faint hiss with soft pops,
     looped. (Made once, in memory.)
     ------------------------------------------------------------------ */
  function makeCrackleBuffer() {
    var sr = ctx.sampleRate, len = Math.floor(sr * 10), i;
    var buffer = ctx.createBuffer(1, len, sr);
    var d = buffer.getChannelData(0);

    var last = 0;                                   // soft low hiss
    for (i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 1.2;
    }
    for (var p = 0; p < 70; p++) {                  // little pops at random moments
      var start = Math.floor(Math.random() * (len - sr * 0.1));
      var size = Math.floor(sr * (0.002 + Math.random() * 0.012));
      var amp = 0.12 + Math.pow(Math.random(), 3) * 0.7;
      for (i = 0; i < size; i++) {
        d[start + i] += (Math.random() * 2 - 1) * amp * Math.exp(-5 * i / size);
      }
    }
    for (i = 0; i < len; i++) {                     // keep peaks gentle
      if (d[i] > 0.8) { d[i] = 0.8; } else if (d[i] < -0.8) { d[i] = -0.8; }
      d[i] *= 0.6;
    }
    var edge = Math.floor(sr * 0.02);               // soften the loop join so it can't click
    for (i = 0; i < edge; i++) { var k = i / edge; d[i] *= k; d[len - 1 - i] *= k; }
    return buffer;
  }

  /* ------------------------------------------------------------------
     Build the sound system (only once, on the visitor's first click)
     ------------------------------------------------------------------ */
  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
      return true;
    }
    try {
      ctx = new AudioCtx();

      // A gentle limiter on everything, so nothing can ever be harshly loud.
      var limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -20;
      limiter.knee.value = 20;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.01;
      limiter.release.value = 0.4;
      limiter.connect(ctx.destination);

      musicBus = ctx.createGain();  musicBus.gain.value = 0;  musicBus.connect(limiter);
      fxBus = ctx.createGain();     fxBus.gain.value = 0;     fxBus.connect(limiter);
      writingGain = ctx.createGain(); writingGain.gain.value = 0; writingGain.connect(musicBus);
      burningGain = ctx.createGain(); burningGain.gain.value = 0; burningGain.connect(musicBus);
      pads.writing = new Pad(TRACKS.writing, writingGain);
      pads.burning = new Pad(TRACKS.burning, burningGain);

      crackleLevel = ctx.createGain(); crackleLevel.gain.value = 0; crackleLevel.connect(fxBus);
      var low = ctx.createBiquadFilter();  low.type = 'highpass';  low.frequency.value = 200;
      var high = ctx.createBiquadFilter(); high.type = 'lowpass';  high.frequency.value = 6500;
      low.connect(high); high.connect(crackleLevel);
      var source = ctx.createBufferSource();
      source.buffer = makeCrackleBuffer();
      source.loop = true;
      source.connect(low);
      source.start();

      if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
      statusLine.textContent = '';
      return true;
    } catch (e) {
      ctx = null;
      statusLine.textContent = "Sound couldn't start in this browser. LET GO still works in silence.";
      return false;
    }
  }

  /* ------------------------------------------------------------------
     Apply the current switches, volumes and phase (always with soft fades)
     ------------------------------------------------------------------ */
  function applyLevels() {
    if (!ctx) { return; }
    var t = ctx.currentTime, p = PHASES[phase];
    musicBus.gain.setTargetAtTime(musicOn ? musicVol * 0.8 : 0, t, 0.4);
    fxBus.gain.setTargetAtTime(fxOn ? fxVol * 0.7 : 0, t, 0.3);
    writingGain.gain.setTargetAtTime(p.writing, t, p.time / 3);
    burningGain.gain.setTargetAtTime(p.burning, t, p.time / 3);
    crackleLevel.gain.setTargetAtTime(p.crackle, t, p.time / 3);
    syncPad(pads.writing, p.writing, p.time);
    syncPad(pads.burning, p.burning, p.time);
  }

  // Start a track when it should be heard; stop it (after it has faded) when it shouldn't.
  function syncPad(pad, level, seconds) {
    var wanted = musicOn && level > 0;
    if (wanted) {
      clearTimeout(pad.stopTimer);
      pad.stopTimer = null;
      pad.start();
    } else if (pad.running && !pad.stopTimer) {
      pad.stopTimer = setTimeout(function () {
        pad.stopTimer = null;
        pad.stop();
      }, musicOn ? seconds * 1000 : 2000);
    }
  }

  api.setPhase = function (name) {
    if (!PHASES[name]) { return; }
    phase = name;
    applyLevels();
  };

  /* ------------------------------------------------------------------
     The little control panel
     ------------------------------------------------------------------ */
  function updateIcon() {
    var on = musicOn || fxOn;
    button.setAttribute('data-sound', on ? 'on' : 'off');
    button.setAttribute('aria-label', 'Sound settings (sound is ' + (on ? 'on' : 'off') + ')');
  }

  function setPanel(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  button.addEventListener('click', function () { setPanel(panel.hidden); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { setPanel(false); button.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (!panel.hidden && !wrapper.contains(e.target)) { setPanel(false); }
  });

  musicToggle.addEventListener('change', function () {
    if (musicToggle.checked && !ensureContext()) { musicToggle.checked = false; }
    musicOn = musicToggle.checked;
    applyLevels();
    updateIcon();
  });
  fxToggle.addEventListener('change', function () {
    if (fxToggle.checked && !ensureContext()) { fxToggle.checked = false; }
    fxOn = fxToggle.checked;
    applyLevels();
    updateIcon();
  });
  musicSlider.addEventListener('input', function () {
    musicVol = musicSlider.value / 100;
    applyLevels();
  });
  fxSlider.addEventListener('input', function () {
    fxVol = fxSlider.value / 100;
    applyLevels();
  });

  updateIcon();
})();
