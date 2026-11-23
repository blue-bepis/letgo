/* =====================================================================
   LET GO — pixelart.js
   Paints the whole world as pixel art, in code.

   HOW IT WORKS (in plain words)
   - The picture is made of 4 layers (sky, mountains, lake, foreground).
     Each layer is a tiny canvas: 400 pixels wide, where 1 pixel = 4 units
     of the old 1600-wide painting. The browser then enlarges it with
     "nearest neighbour" scaling (see `image-rendering: pixelated` in
     style.css), which keeps every pixel crisp.
   - Colours come from one small palette. Gradients are made with a
     "dither" pattern (a checkerboard-like mix of two neighbouring colours),
     the classic pixel-art way to fake smooth shading.
   - A few things move: the fire flickers, the bear blinks, some stars
     twinkle and the moon's reflection shimmers. They redraw ~10 times a
     second, like a slow flip-book.
   - scene.js moves the layers to make the camera rise; this file only draws.

   EDITING TIPS
   - Colours: look for the '#rrggbb' codes (they're all grouped near what
     they colour).
   - Move/resize things: the numbers are in PIXELS of this small canvas.
   This file never touches the letter in any way.
   ===================================================================== */
(function () {
  'use strict';

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function byId(id) { return document.getElementById(id); }
  var cvSky = byId('cv-sky'), cvMountains = byId('cv-mountains'), cvLake = byId('cv-lake'), cvFront = byId('cv-front');
  if (!cvSky || !cvMountains || !cvLake || !cvFront) { return; }

  /* ------------------------------------------------------------------
     SMALL TOOLS
     ------------------------------------------------------------------ */
  var hexCache = {};
  function H(s) {                                   // '#rrggbb' -> [r, g, b]
    if (!hexCache[s]) {
      hexCache[s] = [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
    }
    return hexCache[s];
  }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 4x4 "Bayer" dither pattern: a repeating threshold map between 0 and 1.
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function thr(x, y) { return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }

  // A seeded random generator: the same art every visit.
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // A pixel buffer: a grid of colours we can set one pixel at a time.
  function Buf(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  Buf.prototype.set = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) { return; }
    var i = (y * this.w + x) * 4, d = this.d;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  };
  Buf.prototype.get = function (x, y) { var i = (y * this.w + x) * 4, d = this.d; return [d[i], d[i + 1], d[i + 2]]; };
  Buf.prototype.has = function (x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[(y * this.w + x) * 4 + 3] > 0;
  };
  Buf.prototype.rect = function (x, y, w, h, c) {
    for (var j = 0; j < h; j++) { for (var i = 0; i < w; i++) { this.set(x + i, y + j, c); } }
  };
  // fn(nx, ny) may return a different colour for shading (nx, ny run -1..1 across the shape)
  Buf.prototype.ellipse = function (cx, cy, rx, ry, c, fn) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) { this.set(x, y, (fn && fn(nx, ny)) || c); }
      }
    }
  };
  Buf.prototype.line = function (x0, y0, x1, y1, c, th) {
    var dx = x1 - x0, dy = y1 - y0, steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (var s = 0; s <= steps; s++) {
      this.rect(Math.floor(x0 + dx * s / steps - th / 2 + 0.5), Math.floor(y0 + dy * s / steps - th / 2 + 0.5), th, th, c);
    }
  };
  Buf.prototype.copyFrom = function (o) { this.d.set(o.d); };
  Buf.prototype.paintTo = function (canvas) {
    if (canvas.width !== this.w) { canvas.width = this.w; canvas.height = this.h; }
    canvas.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
  };

  // Smooth wobble along a line, used for ragged mountain ridges.
  function noise1D(n, r) {
    var knots = [], i;
    for (i = 0; i < n / 6 + 2; i++) { knots.push(r() * 2 - 1); }
    var out = [];
    for (i = 0; i < n; i++) {
      var f = i / 6, k = Math.floor(f), t = f - k; t = t * t * (3 - 2 * t);
      out.push(lerp(knots[k], knots[k + 1], t));
    }
    return out;
  }

  /* ==================================================================
     LAYER 1 — SKY, MOON, STARS      (canvas 400 x 330 = 1600 x 1320 units)
     ================================================================== */
  var MOON_X = 307, MOON_Y = 152;      // in pixels of the sky canvas

  function buildSky() {
    var W = 400, HT = 330, b = new Buf(W, HT), r = rng(7), x, y;

    // sky colours, darkest at the top to a pale blue at the horizon
    var ramp = ['#04071a', '#070d28', '#0b1536', '#102046', '#182c58', '#223d6e', '#33538a', '#4a6ba0'].map(H);
    var n = ramp.length;
    for (y = 0; y < HT; y++) {
      var u = y * 4 - 420, t = clamp((u + 420) / 890, 0, 1), pos = t * (n - 1), i = Math.floor(pos), f = pos - i;
      for (x = 0; x < W; x++) {
        b.set(x, y, i >= n - 1 ? ramp[n - 1] : (f > thr(x, y) ? ramp[i + 1] : ramp[i]));
      }
    }

    // soft glow around the moon, in dithered rings
    var GLOW = H('#e9e2b8'), R = 52;
    for (y = MOON_Y - R; y <= MOON_Y + R; y++) {
      for (x = MOON_X - R; x <= MOON_X + R; x++) {
        if (x < 0 || x >= W || y < 0 || y >= HT) { continue; }
        var d = Math.sqrt((x - MOON_X) * (x - MOON_X) + (y - MOON_Y) * (y - MOON_Y));
        if (d >= R || d <= 16) { continue; }
        var a = Math.pow(1 - d / R, 2.4), L = a * 2.6, k = Math.floor(L) + ((L - Math.floor(L)) > thr(x, y) ? 1 : 0);
        if (k > 0) { b.set(x, y, mixc(b.get(x, y), GLOW, Math.min(0.4, 0.1 * k))); }
      }
    }

    // the full moon
    b.ellipse(MOON_X, MOON_Y, 17, 17, H('#f1e8c0'), function (nx, ny) {
      if (nx * nx + ny * ny > 0.86) { return H('#cdbf86'); }          // darker rim
      if (nx * 0.6 + ny * 0.8 > 0.45) { return H('#dccf9f'); }        // shadowed lower-right
      return null;
    });
    [[-6, -5, 3.4], [5, 6, 2.6], [-2, 8, 1.8], [7, -6, 1.6]].forEach(function (c) {   // craters
      b.ellipse(MOON_X + c[0], MOON_Y + c[1], c[2], c[2], H('#d3c68f'), function (nx, ny) {
        return (nx + ny > 0.9) ? H('#e9dfb2') : null;
      });
    });

    // stars
    var stars = [], tries = 0;
    while (stars.length < 170 && tries < 3000) {
      tries++;
      var sx = Math.floor(r() * W), sy = Math.floor(r() * 215);
      if (Math.sqrt((sx - MOON_X) * (sx - MOON_X) + (sy - MOON_Y) * (sy - MOON_Y)) < 34) { continue; }
      if (sy > 170 && r() < 0.6) { continue; }                          // fewer near the bright horizon
      var roll = r();
      var star = { x: sx, y: sy, plus: false, tw: r() < 0.3, period: 3 + r() * 5, phase: r() * 6.28, bg: b.get(sx, sy), level: 1 };
      if (roll < 0.06) { star.plus = true; star.c = H('#fff6dc'); }
      else if (roll < 0.25) { star.c = H('#f4efd9'); }
      else if (roll < 0.6) { star.c = H('#b4c3e6'); }
      else { star.c = H('#7389c0'); }
      stars.push(star);
    }
    stars.forEach(function (s) { drawStar(b, s, 1); });
    return { buf: b, stars: stars };
  }

  // level 1 = full brightness, lower = dimmer (used to twinkle)
  function drawStar(b, s, level) {
    s.level = level;
    b.set(s.x, s.y, level >= 1 ? s.c : mixc(s.bg, s.c, level));
    if (s.plus) {
      var arm = level >= 1 ? mixc(s.bg, s.c, 0.5) : s.bg;
      b.set(s.x - 1, s.y, arm); b.set(s.x + 1, s.y, arm); b.set(s.x, s.y - 1, arm); b.set(s.x, s.y + 1, arm);
    }
  }

  /* ==================================================================
     LAYER 2 — DISTANT MOUNTAINS     (canvas 400 x 190 = units 240..1000)
     ================================================================== */
  function ridgeFn(pts) {                          // pts are in the old units; gives the ridge height in pixels
    var P = pts.map(function (p) { return [p[0] / 4, (p[1] - 240) / 4]; });
    return function (x) {
      for (var i = 0; i < P.length - 1; i++) {
        if (x <= P[i + 1][0]) { return lerp(P[i][1], P[i + 1][1], (x - P[i][0]) / (P[i + 1][0] - P[i][0])); }
      }
      return P[P.length - 1][1];
    };
  }

  function buildMountains() {
    var W = 400, HT = 190, b = new Buf(W, HT), r = rng(21);
    var ranges = [
      { pts: [[0, 360], [120, 300], [220, 352], [340, 250], [470, 340], [560, 300], [700, 384], [820, 292], [960, 362], [1080, 270], [1220, 352], [1340, 300], [1460, 352], [1600, 282]],
        base: '#33507f', lit: '#5272aa', shade: '#2a4372', snow: '#b4c6e4' },          // far range
      { pts: [[0, 404], [160, 352], [300, 412], [460, 342], [620, 422], [760, 382], [900, 432], [1050, 362], [1200, 422], [1350, 372], [1480, 412], [1600, 362]],
        base: '#1f3558', lit: '#30507f', shade: '#172845', snow: null }                // nearer range
    ];
    ranges.forEach(function (R) {
      var ridge = ridgeFn(R.pts), jag = noise1D(W, r);
      var base = H(R.base), lit = H(R.lit), shade = H(R.shade), snow = R.snow && H(R.snow);
      for (var x = 0; x < W; x++) {
        var ry = ridge(x + 0.5) + jag[x] * 1.3, top = Math.round(ry), slope = ridge(x + 1.5) - ridge(x - 0.5);
        for (var y = top; y < HT; y++) {
          var depth = y - top, c = base;
          if (slope > 0.9 && depth < 3 + slope * 1.2) { c = lit; }                        // slopes facing the moon
          else if (slope < -0.9 && depth < 4 + (-slope) * 2) { c = shade; }                // slopes in shadow
          if (depth > 16 && thr(x, y) < (depth - 16) / 34) { c = mixc(c, H('#0b1a30'), 0.35); }
          if (snow && ry < 13) {
            var cap = 2 + (13 - ry) * 0.9;
            if (depth < cap && thr(x, y) < 1 - depth / cap) { c = snow; }                 // snowy peaks
          }
          if (r() < 0.04) { c = mixc(c, r() < 0.5 ? H('#8fa6d0') : H('#0b1a30'), 0.12); } // speckle
          b.set(x, y, c);
        }
      }
    });
    // misty haze where the mountains meet the lake
    for (var y2 = 40; y2 < 51; y2++) {
      for (var x2 = 0; x2 < W; x2++) {
        if (thr(x2, y2) < (y2 - 40) / 10 * 0.55 && b.has(x2, y2)) { b.set(x2, y2, mixc(b.get(x2, y2), H('#5f7cab'), 0.35)); }
      }
    }
    return b;
  }

  /* ==================================================================
     LAYER 3 — THE LAKE              (canvas 400 x 75 = units 420..720)
     ================================================================== */
  function buildLake() {
    var W = 400, HT = 75, b = new Buf(W, HT), r = rng(33), x, y;
    var ramp = ['#3a5a88', '#2d4d7a', '#223f68', '#193157', '#122646', '#0e1e3a'].map(H), n = ramp.length;
    var rows = [];
    for (y = 5; y < 65; y++) {
      var pos = (y - 5) / 59 * (n - 1), i = Math.floor(pos), f = pos - i;
      rows[y] = ramp[Math.min(i, n - 1)];
      for (x = 0; x < W; x++) {
        b.set(x, y, i >= n - 1 ? ramp[n - 1] : (f > thr(x, y) ? ramp[i + 1] : ramp[i]));
      }
    }
    // faint horizontal ripples
    for (y = 7; y < 63; y += 2) {
      for (var k = 0; k < 7; k++) {
        var rx = Math.floor(r() * W), len = 4 + Math.floor(r() * 12);
        for (var j = 0; j < len; j++) { b.set(rx + j, y, mixc(rows[y], H('#6a8cbc'), 0.22)); }
      }
    }
    // dark reflection of the far shore, along the top of the water
    for (y = 5; y < 10; y++) {
      for (x = 0; x < W; x++) {
        if (thr(x, y) < 1 - (y - 5) / 5) { b.set(x, y, mixc(b.get(x, y), H('#10203a'), 0.6)); }
      }
    }
    // tiny pine silhouettes along the far shore
    for (var t = 0; t < 46; t++) {
      var tx = Math.floor(r() * W), th = 3 + Math.floor(r() * 5);
      for (var row = 0; row < th; row++) {
        var half = Math.floor(row / 2);
        for (var px = -half; px <= half; px++) { b.set(tx + px, 5 - th + 1 + row, H('#142842')); }
      }
    }
    return b;
  }

  // the moon's reflection: drawn each frame, so it can shimmer
  var REFLECTION = [{ y: 15, w: 23, h: 2 }, { y: 20, w: 18, h: 2 }, { y: 26, w: 14, h: 1 }, { y: 33, w: 10, h: 1 }, { y: 41, w: 7, h: 1 }];
  function drawReflection(b, t) {
    var tq = Math.floor(t * 2.5), rr = rng(tq * 977 + 5);
    REFLECTION.forEach(function (d, i) {
      var off = Math.round(Math.sin(tq * 0.9 + i * 1.7) * 2), left = MOON_X - Math.floor(d.w / 2) + off;
      for (var p = 0; p < d.w; p++) {
        if (((p + i * 3 + tq) % 7) === 0) { continue; }                      // little gaps that drift
        for (var hh = 0; hh < d.h; hh++) { b.set(left + p, d.y + hh, (p % 5 === 2) ? H('#8f98a4') : H('#d9d2a6')); }
      }
    });
    for (var s = 0; s < 5; s++) {                                              // sparkles
      b.set(MOON_X - 14 + Math.floor(rr() * 28), 13 + Math.floor(rr() * 32), H('#f1ecc8'));
    }
  }

  /* ==================================================================
     LAYER 4 — FOREGROUND            (canvas 400 x 178 = units 200..910)
     ground, pines, campfire, bear
     ================================================================== */
  var FW = 400, FH = 178;
  var FIRE_X = 200, FIRE_Y = 143;        // base of the flames, in pixels
  var BEAR_X = 240, BEAR_Y = 144;        // where the bear sits

  function groundTopLine() {
    var arr = [], t, i;
    function quad(p0, p1, p2) {
      for (t = 0; t <= 1; t += 0.0005) {
        var m = 1 - t, x = m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0], y = m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1];
        arr[Math.floor(x / 4)] = (y - 200) / 4;
      }
    }
    quad([0, 690], [300, 648], [700, 670]);
    quad([700, 670], [1100, 692], [1600, 658]);
    for (i = 0; i < FW; i++) { if (arr[i] === undefined) { arr[i] = arr[i - 1] !== undefined ? arr[i - 1] : 120; } }
    return arr;
  }

  // One pine tree built from stacked, jagged tiers.
  function pine(b, cx, top, bottom, baseHalf, pal, r) {
    var tiers = Math.max(4, Math.round((bottom - top) / 15));
    var trunkH = Math.max(3, Math.round((bottom - top) * 0.07));
    var foliageBottom = bottom - trunkH, span = foliageBottom - top;
    var dark = H(pal[0]), mid = H(pal[1]), light = H(pal[2]), trunk = H('#3a2418'), trunkLight = H('#5a3a24');
    var tw = Math.max(3, Math.round(baseHalf / 6));
    b.rect(Math.round(cx - tw / 2), foliageBottom - 2, tw, trunkH + 2, trunk);                // trunk
    b.rect(Math.round(cx - tw / 2) + tw - 1, foliageBottom - 2, 1, trunkH + 2, trunkLight);
    for (var tier = 0; tier < tiers; tier++) {
      var y0 = Math.round(top + span * (tier / tiers) * 0.8);
      var y1 = Math.min(foliageBottom, Math.round(y0 + span / tiers * 1.55));
      var wBottom = 3 + (baseHalf - 3) * Math.pow((tier + 1) / tiers, 0.9);
      for (var y = y0; y <= y1; y++) {
        var rr = (y - y0) / Math.max(1, y1 - y0);
        var hw = Math.round(lerp(1, wBottom, rr) + (r() < 0.35 ? 1 : 0) - (r() < 0.2 ? 1 : 0));
        for (var x = -hw; x <= hw; x++) {
          var c = mid;
          if (x <= -hw + 1) { c = dark; }                                  // shaded left edge
          else if (x >= hw - 1 && hw > 2) { c = light; }                    // moonlit right edge
          else if (r() < 0.14) { c = dark; }
          else if (r() < 0.08) { c = light; }
          if (y === y1) { c = dark; }                                       // shadow under each tier
          b.set(cx + x, y, c);
        }
      }
    }
  }

  function buildFront() {
    var b = new Buf(FW, FH), r = rng(55), x, y;
    var top = groundTopLine();
    var ramp = ['#2a4631', '#223c2c', '#1b3025', '#14241d', '#0f1b16', '#0b1411'].map(H), n = ramp.length;

    // ground
    for (x = 0; x < FW; x++) {
      var gy = Math.round(top[x]);
      for (y = gy; y < FH; y++) {
        var t = clamp((y - 105) / (FH - 105), 0, 1), pos = t * (n - 1), i = Math.floor(pos), f = pos - i;
        var c = i >= n - 1 ? ramp[n - 1] : (f > thr(x, y) ? ramp[i + 1] : ramp[i]);
        if (y - gy < 2) { c = H('#4a6258'); }                                       // wet shoreline
        else if (y - gy === 2) { c = H('#1f352c'); }
        b.set(x, y, c);
      }
    }
    // grass tufts, pebbles and a few tiny flowers
    for (var g = 0; g < 320; g++) {
      var qx = Math.floor(r() * FW), qy = Math.floor(top[qx]) + 4 + Math.floor(r() * (FH - top[qx] - 6));
      var gc = r() < 0.6 ? H('#386b45') : (r() < 0.5 ? H('#2c5a3a') : H('#4a8050')), bh = 1 + Math.floor(r() * 2);
      for (var k = 0; k < bh; k++) { b.set(qx, qy - k, gc); }
    }
    for (var pb = 0; pb < 26; pb++) {
      var px = Math.floor(r() * FW), py = Math.floor(top[px]) + 3 + Math.floor(r() * 12);
      b.rect(px, py, 2, 1, H('#6a7384')); b.set(px, py + 1, H('#3e4655'));
    }
    for (var fl = 0; fl < 16; fl++) {
      var fx = Math.floor(r() * FW), fy = Math.floor(top[fx]) + 6 + Math.floor(r() * 30);
      b.set(fx, fy, r() < 0.5 ? H('#e9833a') : H('#f2c14e'));
    }
    // scorched earth under the fire
    for (y = 141; y < 153; y++) {
      for (x = 172; x < 229; x++) {
        var dd = Math.pow((x - FIRE_X) / 28, 2) + Math.pow((y - 147) / 6, 2);
        if (dd < 1 && thr(x, y) < 1 - dd * 0.8 && b.has(x, y)) { b.set(x, y, mixc(b.get(x, y), H('#070d0b'), 0.7)); }
      }
    }

    // pines framing the left and right (mid-distance first, nearest last)
    var Z1 = ['#0f2a22', '#17402f', '#2a6046'], Z2 = ['#0b1f19', '#12352a', '#215040'], Z3 = ['#071410', '#0c2119', '#16372b'];
    pine(b, 46, 45, 120, 18, Z1, r);   pine(b, 15, 12, 132, 30, Z2, r);   pine(b, -6, 55, 140, 21, Z3, r);
    pine(b, 344, 50, 125, 18, Z1, r);  pine(b, 386, 5, 130, 31, Z2, r);   pine(b, 396, 57, 142, 21, Z3, r);

    // stones around the fire
    var stones = [[186, 140, 0], [214, 140, 0], [180, 146, 1], [187, 150, 1], [200, 152, 1], [213, 150, 1], [220, 146, 1]];
    stones.forEach(function (s) {
      b.ellipse(s[0], s[1], 4, 3.2, H('#6a6f82'), function (nx, ny) {
        if (nx + ny > 0.85) { return H('#444859'); }
        if (ny < -0.2 && nx < 0.3) { return H('#8c92a6'); }
        return null;
      });
    });
    return b;
  }

  /* ---------- the campfire (redrawn every frame) ---------- */
  var growth = 0;                 // 0 = calm campfire, 1 = roaring (while the letter burns)

  function heatColour(heat) {
    if (heat > 1.05) { return H('#fff4c8'); }
    if (heat > 0.85) { return H('#ffe08a'); }
    if (heat > 0.6) { return H('#ffb347'); }
    if (heat > 0.38) { return H('#f0762a'); }
    if (heat > 0.2) { return H('#c2411a'); }
    return H('#7a1f12');
  }

  function drawFire(b, t) {
    var H0 = Math.round(26 * (1 + 0.38 * growth)), W0 = 16 * (1 + 0.2 * growth);
    var tongues = [
      { dx: -5.5, h: 0.55, w: 0.55, ph: 1.3, dim: 0.85 },
      { dx: 5.5, h: 0.62, w: 0.55, ph: 4.1, dim: 0.85 },
      { dx: 0.5, h: 1, w: 1, ph: 0, dim: 1 }                   // main flame last, so it sits on top
    ];
    tongues.forEach(function (tg) {
      var th = Math.round(H0 * tg.h), tw = W0 * tg.w;
      for (var i = 0; i < th; i++) {
        var v = i / th, hw = (tw / 2) * Math.pow(1 - v, 0.85) * (0.88 + 0.24 * Math.sin(t * 11 + i * 1.3 + tg.ph));
        var cx = FIRE_X + tg.dx + Math.sin(t * 5.5 + tg.ph + v * 4.2) * (1.2 + 2.2 * v);
        for (var x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
          var d = Math.abs(x + 0.5 - cx) / Math.max(0.5, hw);
          d += (thr(x, FIRE_Y - i) - 0.5) * 0.35;                // dithered edges between colours
          if (d > 1) { continue; }
          b.set(x, FIRE_Y - i, heatColour(((1 - d) * 0.8 + (1 - v) * 0.35) * tg.dim));
        }
      }
    });
    // sparks rising from the fire
    var sparks = 6 + Math.round(9 * growth);
    for (var s = 0; s < sparks; s++) {
      var phase = (t * 0.55 + s * 0.37) % 1;
      if (((s * 7 + Math.floor(t * 8)) % 5) === 0) { continue; }
      b.set(FIRE_X + Math.sin(s * 12.9 + t * 1.3) * (6 + phase * 8), FIRE_Y - 8 - phase * 38 * (1 + growth * 0.4),
        phase < 0.5 ? H('#ffd36a') : H('#f0762a'));
    }
  }

  function drawLog(b, cx, cy, len, angle) {
    var dx = Math.cos(angle) * len / 2, dy = Math.sin(angle) * len / 2;
    b.line(cx - dx, cy - dy, cx + dx, cy + dy, H('#4a2a1a'), 4);
    b.line(cx - dx, cy - dy - 1, cx + dx, cy + dy - 1, H('#6b3d22'), 1);
    b.set(cx + dx, cy + dy, H('#b88a5a')); b.set(cx + dx, cy + dy + 1, H('#b88a5a'));    // cut ends
    b.set(cx - dx, cy - dy, H('#b88a5a')); b.set(cx - dx, cy - dy + 1, H('#b88a5a'));
  }

  // warm firelight on whatever is near the fire
  function glowPass(b, t) {
    var g = (0.8 + 0.2 * Math.sin(t * 6.1) + 0.1 * Math.sin(t * 13.7)) * (1 + 0.45 * growth);
    var rx = 62, ry = 26, cx = FIRE_X, cy = 144, WARM = [255, 150, 60];
    for (var y = cy - ry; y <= cy + ry; y++) {
      for (var x = cx - rx; x <= cx + rx; x++) {
        var d = Math.sqrt(Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2));
        if (d >= 1 || !b.has(x, y)) { continue; }
        var a = Math.pow(1 - d, 1.5) * g * 3.2, k = Math.floor(a) + ((a - Math.floor(a)) > thr(x, y) ? 1 : 0);
        if (k > 0) { b.set(x, y, mixc(b.get(x, y), WARM, Math.min(0.5, 0.12 * k))); }
      }
    }
  }

  /* ---------- the bear (redrawn every frame so it can blink) ---------- */
  var bearBlinkUntil = 0, bearNextBlink = 2.5;
  function drawBear(b, t) {
    var bx = BEAR_X, by = BEAR_Y;
    if (t >= bearNextBlink) { bearBlinkUntil = t + 0.18; bearNextBlink = t + 3 + (Math.sin(t * 12.9) + 1) * 2.2; }
    var blink = t < bearBlinkUntil;
    var headDy = (Math.sin(t * 0.55) > 0.92) ? 1 : 0;                   // a tiny head dip now and then
    var stickDy = Math.round(Math.sin(t * 1.1) * 0.8);

    var OUT = H('#24150e'), FUR = H('#6b4a37'), FUR_D = H('#4a2f20'), RIM = H('#b0763f'), BELLY = H('#8a6650'), MUZ = H('#b99068');
    function furShade(nx, ny) { if (nx < -0.6) { return RIM; } if (nx > 0.45 && ny > 0.1) { return FUR_D; } return null; }

    b.ellipse(bx, by + 1, 13, 3, H('#0a1310'));                          // shadow on the grass
    // outline first (a slightly bigger dark shape), then the fur on top
    b.ellipse(bx - 8, by - 2, 5.8, 4, OUT); b.ellipse(bx + 8, by - 2, 5.8, 4, OUT);
    b.ellipse(bx, by - 12, 11.5, 14, OUT);
    b.ellipse(bx - 8, by - 2, 4.8, 3, FUR_D, function (nx) { return nx < -0.5 ? RIM : null; });   // feet
    b.ellipse(bx + 8, by - 2, 4.8, 3, FUR_D);
    b.ellipse(bx, by - 12, 10.5, 13, FUR, furShade);                                                 // body
    b.ellipse(bx, by - 10, 6, 8.5, BELLY);                                                           // belly

    // arm reaching to the fire, with the roasting stick
    var hx = bx - 15, hy = by - 23, ex = bx - 36, ey = by - 11 + stickDy;
    b.line(bx - 7, by - 20, hx, hy, OUT, 5);
    b.line(bx - 7, by - 20, hx, hy, FUR, 3);
    b.line(hx, hy, ex, ey, H('#6b4a2a'), 1);
    b.rect(ex - 4, ey - 2, 5, 3, H('#f6f0e0'));                                                       // marshmallow
    b.rect(ex - 4, ey - 2, 2, 3, H('#d99a4a'));                                                       // toasted end

    // head
    var hY = by - 28.5 + headDy;
    b.ellipse(bx - 6, hY - 6.5, 3.6, 3.6, OUT); b.ellipse(bx + 6, hY - 6.5, 3.6, 3.6, OUT);          // ears
    b.ellipse(bx, hY, 9, 9, OUT);
    b.ellipse(bx - 6, hY - 6.5, 2.8, 2.8, FUR); b.ellipse(bx + 6, hY - 6.5, 2.8, 2.8, FUR);
    b.ellipse(bx - 6, hY - 6.5, 1.3, 1.3, BELLY); b.ellipse(bx + 6, hY - 6.5, 1.3, 1.3, BELLY);
    b.ellipse(bx, hY, 8, 8, FUR, furShade);
    b.ellipse(bx, hY + 2.5, 3.9, 2.9, MUZ);                                                          // muzzle
    b.rect(bx - 1, hY + 1, 2, 1, H('#2a1810'));                                                      // nose
    if (blink) {
      b.rect(bx - 4, hY - 1, 2, 1, H('#1c120e')); b.rect(bx + 2, hY - 1, 2, 1, H('#1c120e'));
    } else {
      b.rect(bx - 4, hY - 2, 1, 2, H('#1c120e')); b.rect(bx + 3, hY - 2, 1, 2, H('#1c120e'));
      b.set(bx - 4, hY - 2, H('#ffffff')); b.set(bx + 3, hY - 2, H('#ffffff'));                       // eye shine
      b.set(bx - 4, hY - 1, H('#1c120e')); b.set(bx + 3, hY - 1, H('#1c120e'));
    }
  }

  /* ------------------------------------------------------------------
     PAINT EVERYTHING, THEN KEEP A FEW THINGS MOVING
     ------------------------------------------------------------------ */
  var sky = buildSky(), skyLive = new Buf(400, 330); skyLive.copyFrom(sky.buf);
  buildMountains().paintTo(cvMountains);
  var lakeBase = buildLake(), lakeLive = new Buf(400, 75);
  var frontBase = buildFront(), frontLive = new Buf(FW, FH);

  function paintSky(t) {
    sky.stars.forEach(function (s) {
      if (!s.tw) { return; }
      var v = 0.5 + 0.5 * Math.sin(t * 6.283 / s.period + s.phase);
      var level = v < 0.3 ? 0.3 : (v < 0.6 ? 0.65 : 1);
      if (level !== s.level) { drawStar(skyLive, s, level); }
    });
    skyLive.paintTo(cvSky);
  }
  function paintLake(t) {
    lakeLive.copyFrom(lakeBase);
    drawReflection(lakeLive, t);
    lakeLive.paintTo(cvLake);
  }
  function paintFront(t) {
    growth += ((document.body.classList.contains('is-burning') ? 1 : 0) - growth) * 0.07;
    frontLive.copyFrom(frontBase);
    glowPass(frontLive, t);
    drawFire(frontLive, t);
    drawLog(frontLive, FIRE_X, 143.5, 29, -0.21);
    drawLog(frontLive, FIRE_X, 143.5, 29, 0.21);
    drawBear(frontLive, t);
    frontLive.paintTo(cvFront);
  }

  paintSky(0); paintLake(0); paintFront(0);

  var sceneEl = byId('scene'), last = 0, tick = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (now - last < 100) { return; }
    last = now; tick++;
    var t = reduced ? 0 : now / 1000;
    if (cvFront.style.visibility !== 'hidden') { paintFront(t); }
    if (!reduced && sceneEl && !sceneEl.classList.contains('is-moving')) {
      if (tick % 3 === 0) { paintSky(t); }
      if (tick % 2 === 0) { paintLake(t); }
    }
  }
  requestAnimationFrame(loop);
})();
