/* =====================================================================
   LET GO — scene.js
   Looks after the painted world:
     1. scatters the stars,
     2. places the four picture layers to fill the screen,
     3. moves them to make the camera rise up to the sky (and back).
   This file never touches the letter in any way.
   ===================================================================== */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function byId(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------
     1. (The stars, moon and everything else are drawn by pixelart.js.)
     ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------
     1. LAYERS: where each picture layer sits, and how far it travels
     ------------------------------------------------------------------ */
  var sceneEl = byId('scene');

  // top/height = the slice of the 1600x900 painting each layer holds.
  // move = how far (in painting units) it slides down during the journey.
  // Far things move less than near things; that difference is the "depth".
  var LAYERS = {
    sky:       { el: byId('cv-sky'),       top: -420, height: 1320, move: 250 },
    mountains: { el: byId('cv-mountains'), top: 240,  height: 760,  move: 520 },
    lake:      { el: byId('cv-lake'),      top: 420,  height: 300,  move: 900 },
    front:     { el: byId('cv-front'),     top: 200,  height: 710,  move: 1180 }
  };
  var MOON_X = 1230, MOON_Y = 190;
  var MOON_ZOOM = 0.3;        // the sky grows by 30% as we arrive, so the moon feels near

  var scale = 1, viewW = 0, viewH = 0;
  var progress = 0;           // 0 = campsite (start), 1 = sky (end)
  var rafId = 0, timer = 0;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // How far to slide the sky sideways at the end so the moon is on screen (matters on phones).
  function panUnits() {
    var halfWidth = viewW / (2 * scale);
    var target = Math.min(MOON_X, 800 + halfWidth - 110);
    return target - MOON_X;
  }

  function layout() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    scale = Math.max(viewW / 1600, viewH / 900);          // fill the screen, bottom-centred
    var left = (viewW - 1600 * scale) / 2;
    var topOfPainting = viewH - 900 * scale;

    Object.keys(LAYERS).forEach(function (key) {
      var layer = LAYERS[key];
      if (!layer.el) { return; }
      layer.el.style.left = left + 'px';
      layer.el.style.top = (topOfPainting + layer.top * scale) + 'px';
      layer.el.style.width = (1600 * scale) + 'px';
      layer.el.style.height = (layer.height * scale) + 'px';
    });
    if (LAYERS.sky.el) {
      LAYERS.sky.el.style.transformOrigin =
        (MOON_X * scale) + 'px ' + ((MOON_Y - LAYERS.sky.top) * scale) + 'px';
    }
    apply(progress);
  }

  // Put the camera at position f (0 = start, 1 = sky).
  function apply(f) {
    progress = f;
    Object.keys(LAYERS).forEach(function (key) {
      var layer = LAYERS[key];
      if (!layer.el) { return; }
      if (f <= 0) {
        layer.el.style.transform = '';
        layer.el.style.visibility = '';
        return;
      }
      var extra = (key === 'sky' && viewH > viewW * 1.15) ? 200 : 0;   // tall screens: moon ends lower, clear of the words
      var down = (layer.move + extra) * scale * f;
      if (key === 'sky') {
        layer.el.style.transform = 'translate3d(' + (panUnits() * scale * f) + 'px,' + down + 'px,0) scale(' + (1 + MOON_ZOOM * f) + ')';
      } else {
        layer.el.style.transform = 'translate3d(0,' + down + 'px,0)';
      }
      // once the lake and foreground have left the screen, stop drawing them
      if (key === 'front' || key === 'lake') {
        layer.el.style.visibility = f > 0.62 ? 'hidden' : '';
      }
    });
  }

  function smootherstep(u) { return u * u * u * (u * (u * 6 - 15) + 10); }

  /* ------------------------------------------------------------------
     2. THE JOURNEY UP
     ------------------------------------------------------------------ */
  // options: duration (ms), reduced (bool), onShootingStar(), onDone()
  var tween = null;           // the journey in progress (so it can be skipped)

  function finishRise(options) {
    sceneEl.classList.remove('is-moving');
    tween = null;
    if (options.onDone) { options.onDone(); }
  }

  function rise(options) {
    options = options || {};
    cancelAnimationFrame(rafId);
    clearTimeout(timer);
    sceneEl.classList.add('is-moving');     // pauses twinkling while we travel (keeps it smooth)

    if (options.reduced) {                  // gentle fade instead of movement
      sceneEl.classList.add('is-fading');
      timer = setTimeout(function () {
        apply(1);
        sceneEl.classList.remove('is-fading');
        timer = setTimeout(function () { finishRise(options); }, 500);
      }, 700);
      return;
    }

    var duration = options.duration || 13000;
    var startTime = null, shotFired = false;
    tween = { options: options, from: 0, startTime: null, duration: duration, quick: false, u: 0 };

    function step(now) {
      if (!tween) { return; }
      if (tween.startTime === null) { tween.startTime = now; }
      var v = Math.min(1, (now - tween.startTime) / tween.duration);
      var f;
      if (tween.quick) {                      // skipping: ease out from where we are
        f = tween.from + (1 - tween.from) * (1 - (1 - v) * (1 - v));
      } else {
        tween.u = v;
        f = smootherstep(v);
      }
      apply(f);
      if (!tween.quick && !shotFired && v >= 0.72) {
        shotFired = true;
        if (options.onShootingStar) { options.onShootingStar(); }
      }
      if (v < 1) { rafId = requestAnimationFrame(step); } else { finishRise(options); }
    }
    rafId = requestAnimationFrame(step);
  }

  // "Skip": glide the rest of the way up in about a second.
  function skipRise() {
    if (!tween || tween.quick) { return; }
    tween.quick = true;
    tween.from = progress;
    tween.startTime = null;
    tween.duration = 1100;
  }

  // Back to the campsite, with a soft fade (the writing screen is waiting behind it).
  function reset(done) {
    cancelAnimationFrame(rafId);
    clearTimeout(timer);
    sceneEl.classList.add('is-fading');
    timer = setTimeout(function () {
      apply(0);
      sceneEl.classList.remove('is-moving');
      sceneEl.classList.remove('is-fading');
      if (done) { done(); }
    }, reducedMotion() ? 60 : 1000);
  }

  // One shooting star, drawn as a thin glowing line gliding across the upper sky.
  function shootingStar() {
    var el = byId('shooting-star');
    if (!el || reducedMotion()) { return; }
    var x0 = viewW * 0.68, y0 = viewH * 0.10;
    var x1 = viewW * 0.22, y1 = viewH * 0.34;
    el.style.setProperty('--x0', x0 + 'px');
    el.style.setProperty('--y0', y0 + 'px');
    el.style.setProperty('--x1', x1 + 'px');
    el.style.setProperty('--y1', y1 + 'px');
    el.style.setProperty('--rot', Math.atan2(y1 - y0, x1 - x0) + 'rad');
    el.classList.remove('go');
    void el.offsetWidth;                          // lets the animation restart cleanly
    el.classList.add('go');
    el.addEventListener('animationend', function done() {
      el.classList.remove('go');
      el.removeEventListener('animationend', done);
    });
  }

  // Where the campfire flames are on screen (the letter is thrown to here).
  // These numbers are the fire's position in the 1600 x 900 painting.
  function fireBox() {
    var left = (viewW - 1600 * scale) / 2, top = viewH - 900 * scale;
    return { x: left + 744 * scale, y: top + 650 * scale, w: 112 * scale, h: 128 * scale };
  }

  // How big one art pixel is on screen (the burn uses this so its sparks match).
  function pixelSize() { return Math.max(2, Math.round(scale * 4)); }

  window.addEventListener('resize', layout);
  layout();

  window.LetGoScene = { pixelSize: pixelSize, rise: rise, skipRise: skipRise, reset: reset, shootingStar: shootingStar, fireBox: fireBox };
})();
