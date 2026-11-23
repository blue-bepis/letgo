/* =====================================================================
   LET GO — burn.js
   Draws the paper letter flying into the fire and burning away.

   HOW THE BURN WORKS (in plain words)
   - The letter is painted onto a hidden canvas (the "paper").
   - The paper is divided into a coarse grid of little cells. Each cell
     gets a "burn time": cells near where the fire touches the paper
     (the bottom) burn first, with a wobble of noise so the edge is ragged.
   - Every frame we work out, for each cell: untouched, scorched brown,
     glowing orange ember, black char, or gone. We paint those colours
     over the paper and erase the gone cells. Because the grid is coarse
     and gets smoothed when enlarged, the edges look soft and watery.
   - Flame licks, embers and flecks of ash (all little squares, to match
     the pixel art) float up from the burning edge.

   PRIVACY: the letter's text is drawn onto this canvas only for the few
   seconds of the burn. As soon as the paper is gone, wipe() shrinks every
   canvas to nothing and forgets the text. Nothing is saved or sent.
   ===================================================================== */
(function () {
  'use strict';

  var TOTAL = 1.14;     // the burn bands run a little past 1 so every cell finishes

  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // Smooth random "cloud" values (0..1) over the grid, for ragged burn edges.
  function noiseField(cols, rows) {
    var out = new Float32Array(cols * rows);
    [[4, 0.5], [9, 0.3], [18, 0.2]].forEach(function (octave) {
      var gx = octave[0], gy = Math.max(2, Math.round(octave[0] * rows / cols));
      var grid = new Float32Array((gx + 1) * (gy + 1)), i;
      for (i = 0; i < grid.length; i++) { grid[i] = Math.random(); }
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var fx = x / (cols - 1) * gx, fy = y / (rows - 1) * gy;
          var x0 = Math.min(gx - 1, Math.floor(fx)), y0 = Math.min(gy - 1, Math.floor(fy));
          var tx = smooth(fx - x0), ty = smooth(fy - y0);
          var a = grid[y0 * (gx + 1) + x0], b = grid[y0 * (gx + 1) + x0 + 1];
          var c = grid[(y0 + 1) * (gx + 1) + x0], d = grid[(y0 + 1) * (gx + 1) + x0 + 1];
          out[y * cols + x] += lerp(lerp(a, b, tx), lerp(c, d, tx), ty) * octave[1];
        }
      }
    });
    return out;
  }

  // Break the letter into lines that fit the paper's width.
  function wrapLines(g, text, maxWidth, maxLines) {
    var lines = [];
    var paragraphs = text.replace(/\r/g, '').split('\n');
    for (var p = 0; p < paragraphs.length; p++) {
      var par = paragraphs[p];
      if (par.trim() === '') { lines.push(''); }
      else {
        var line = '', words = par.split(' ');
        for (var w = 0; w < words.length; w++) {
          var word = words[w], test = line ? line + ' ' + word : word;
          if (g.measureText(test).width <= maxWidth) { line = test; continue; }
          if (line) { lines.push(line); line = ''; }
          while (g.measureText(word).width > maxWidth && word.length > 1) {   // a single huge word
            var n = word.length;
            while (n > 1 && g.measureText(word.slice(0, n)).width > maxWidth) { n--; }
            lines.push(word.slice(0, n));
            word = word.slice(n);
          }
          line = word;
        }
        lines.push(line);
      }
      if (lines.length >= maxLines) { break; }
    }
    return lines;
  }

  // Paint the parchment sheet with the letter on it.
  function makePaper(opts, dpr) {
    var pw = Math.max(120, Math.round(opts.panel.width));
    var ph = Math.max(120, Math.round(opts.panel.height));
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(pw * dpr);
    canvas.height = Math.round(ph * dpr);
    var g = canvas.getContext('2d');
    g.scale(dpr, dpr);

    g.fillStyle = '#efdfb8';
    g.fillRect(0, 0, pw, ph);
    var i;
    g.fillStyle = 'rgba(120,80,40,0.07)';                         // faint blocky grain
    for (i = 0; i < 160; i++) { g.fillRect(Math.floor(rand(0, pw / 6)) * 6, Math.floor(rand(0, ph / 6)) * 6, 6, 6); }
    g.fillStyle = '#d2b27a'; g.fillRect(4, 4, pw - 8, 4); g.fillRect(4, ph - 8, pw - 8, 4);   // inner frame
    g.fillRect(4, 4, 4, ph - 8); g.fillRect(pw - 8, 4, 4, ph - 8);
    g.strokeStyle = '#2a1a10'; g.lineWidth = 4; g.strokeRect(2, 2, pw - 4, ph - 4);            // outer frame

    var pad = Math.min(44, Math.round(pw * 0.06) + 4);
    var fs = opts.fontPx, lh = fs * 1.6;
    var family = opts.fontFamily || 'Georgia, serif';
    g.textBaseline = 'alphabetic';
    var y = pad + fs;
    g.font = 'italic ' + fs + 'px ' + family;
    g.fillStyle = 'rgba(51,41,31,0.72)';
    g.fillText('Dear nobody,', pad, y);
    y += lh * 1.1;
    g.font = fs + 'px ' + family;
    g.fillStyle = '#33291f';
    var maxLines = Math.max(1, Math.floor((ph - pad - y) / lh) + 1);
    var lines = wrapLines(g, opts.text, pw - pad * 2, maxLines);
    for (i = 0; i < lines.length; i++) {
      if (y > ph - pad * 0.4) { break; }
      if (lines[i]) { g.fillText(lines[i], pad, y); }
      y += lh;
    }
    return { canvas: canvas, pw: pw, ph: ph };
  }

  /* ------------------------------------------------------------------
     start(): run the whole throw + burn.
     opts: text, panel {left,top,width,height}, fire {x,y,w,h},
           fontPx, fontFamily, reduced, onIgnite(), onDone()
     returns { skip(), cancel() }
     ------------------------------------------------------------------ */
  function start(opts) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var vw = window.innerWidth, vh = window.innerHeight;

    var screen = document.createElement('canvas');
    screen.className = 'burn-canvas';
    screen.setAttribute('aria-hidden', 'true');
    screen.width = Math.round(vw * dpr);
    screen.height = Math.round(vh * dpr);
    var ctx = screen.getContext('2d');
    if (!ctx) { throw new Error('canvas unavailable'); }
    document.body.appendChild(screen);

    var paper = makePaper(opts, dpr);
    var pw = paper.pw, ph = paper.ph;
    var work = document.createElement('canvas');
    work.width = paper.canvas.width;
    work.height = paper.canvas.height;
    var wctx = work.getContext('2d');
    wctx.imageSmoothingEnabled = false;          // blocky, pixel-style burn edges

    // ---- the burn grid ----
    var gc = 60, gr = Math.max(24, Math.round(gc * ph / pw)), cells = gc * gr;
    var noise = noiseField(gc, gr);
    var burnTime = new Float32Array(cells);
    var flick = new Float32Array(cells);
    var origins = [{ x: 0.5, d: 0 }, { x: rand(0.12, 0.35), d: 0.05 }, { x: rand(0.65, 0.88), d: 0.09 }];
    var maxD = Math.sqrt((pw / 2) * (pw / 2) + ph * ph), lo = 9, hi = -9, cx, cy, i, o;
    for (cy = 0; cy < gr; cy++) {
      for (cx = 0; cx < gc; cx++) {
        i = cy * gc + cx;
        var nx = (cx + 0.5) / gc, ny = (cy + 0.5) / gr, best = 9;
        for (o = 0; o < origins.length; o++) {
          var dx = (nx - origins[o].x) * pw, dy = (1 - ny) * ph;
          best = Math.min(best, Math.sqrt(dx * dx + dy * dy) / maxD + origins[o].d);
        }
        burnTime[i] = 0.78 * best + 0.22 * noise[i];
        flick[i] = Math.random();
        lo = Math.min(lo, burnTime[i]);
        hi = Math.max(hi, burnTime[i]);
      }
    }
    for (i = 0; i < cells; i++) { burnTime[i] = (burnTime[i] - lo) / (hi - lo); }

    var maskCanvas = document.createElement('canvas'); maskCanvas.width = gc; maskCanvas.height = gr;
    var charCanvas = document.createElement('canvas'); charCanvas.width = gc; charCanvas.height = gr;
    var maskCtx = maskCanvas.getContext('2d'), charCtx = charCanvas.getContext('2d');
    var maskData = maskCtx.createImageData(gc, gr), charData = charCtx.createImageData(gc, gr);
    var front = [];                                   // cells that are burning right now

    // ---- geometry of the throw ----
    var fire = opts.fire;
    var startC = { x: opts.panel.left + pw / 2, y: opts.panel.top + ph / 2 };
    var endC = { x: fire.x + fire.w / 2 - 14, y: fire.y + fire.h * 0.5 };
    var ctrl = { x: (startC.x + endC.x) / 2 + rand(-60, 60), y: Math.min(startC.y, endC.y) - vh * 0.22 };
    var sEnd = Math.min(clamp(fire.w * 2.6, 150, 240) / pw, Math.max(fire.h * 1.6, 140) / ph);

    var FLIGHT = 1500, HOLD = 450, BURN = opts.burnMs || 11000;
    var px = opts.pixel || 4;                       // one art pixel on screen
    function snap(v) { return Math.round(v / px) * px; }
    var particles = [];

    var elapsed = 0, last = 0, tScale = 1, raf = 0, ignited = false, gone = false, finished = false, tail = 0;
    var pose = { x: startC.x, y: startC.y, rot: 0, scale: 1, sx: 1, sy: 1, skew: 0, alpha: 1 };
    var p = 0;

    function burnProgress() {
      var tb = clamp((elapsed - FLIGHT - HOLD) / BURN, 0, 1);
      return 0.3 * tb + 0.7 * smooth(tb);
    }

    function updatePose(time) {
      if (opts.reduced) {
        pose.x = startC.x; pose.y = startC.y; pose.rot = 0; pose.scale = 1; pose.sx = pose.sy = 1; pose.skew = 0;
        pose.alpha = 1 - smooth(elapsed / 1600);
        return;
      }
      if (elapsed < FLIGHT) {                         // the toss: a high arc, a little tumble
        var t = elapsed / FLIGHT, e = easeInOut(t), inv = 1 - e;
        pose.x = inv * inv * startC.x + 2 * inv * e * ctrl.x + e * e * endC.x;
        pose.y = inv * inv * startC.y + 2 * inv * e * ctrl.y + e * e * endC.y;
        pose.rot = e * 0.1 - Math.sin(t * Math.PI) * 0.45;
        pose.scale = lerp(1, sEnd, e);
        pose.sx = pose.sy = 1; pose.skew = 0;
      } else {                                        // resting in the fire: curls and sags as it burns
        pose.x = endC.x;
        pose.y = endC.y + 16 * smooth(p);          // sinks into the embers as it burns
        pose.rot = 0.1 + 0.05 * p * Math.sin(time * 0.0023);
        pose.scale = sEnd;
        pose.sx = 1 + 0.05 * p;
        pose.sy = 1 - 0.3 * Math.pow(p, 1.2);
        pose.skew = 0.12 * p * Math.sin(p * 4 + 0.5);
      }
      pose.alpha = 1;
    }

    // Where a point on the paper (grid cell) is on screen right now.
    function cellToScreen(cellX, cellY) {
      var lx = ((cellX + 0.5) / gc - 0.5) * pw * pose.scale * pose.sx;
      var ly = ((cellY + 0.5) / gr - 0.5) * ph * pose.scale * pose.sy;
      lx += pose.skew * ly;
      var cr = Math.cos(pose.rot), sr = Math.sin(pose.rot);
      return { x: pose.x + lx * cr - ly * sr, y: pose.y + lx * sr + ly * cr };
    }

    // Work out what every cell looks like at this moment of the burn.
    function updateCells(time) {
      var md = maskData.data, cd = charData.data;
      front.length = 0;
      for (var k = 0; k < cells; k++) {
        var s = p * TOTAL - burnTime[k];
        var f = 0.75 + 0.25 * Math.sin(time * 0.009 + flick[k] * 40);
        var r = 0, g = 0, b = 0, a = 0, m = 0;
        if (s >= -0.1) {
          if (s < 0) {                                          // scorching brown ahead of the fire
            r = 110; g = 64; b = 28; a = (s + 0.1) / 0.1 * 0.55;
          } else if (s < 0.05) {                                // glowing ember line
            r = 255; g = 140 + 70 * f; b = 40; a = 0.95;
            front.push(k);
          } else if (s < 0.11) {                                // black char
            var c = (s - 0.05) / 0.06;
            r = lerp(150, 28, c); g = lerp(62, 18, c); b = lerp(20, 14, c); a = 0.96;
            if (s < 0.08) { front.push(k); }
          } else if (s < 0.15) {                                // crumbling to nothing
            var d = (s - 0.11) / 0.04;
            r = 28; g = 18; b = 14; a = 1 - d; m = d;
          } else { m = 1; }
        }
        var j = k * 4;
        cd[j] = r; cd[j + 1] = g; cd[j + 2] = b; cd[j + 3] = a * 255;
        md[j] = 0; md[j + 1] = 0; md[j + 2] = 0; md[j + 3] = m * 255;
      }
      charCtx.putImageData(charData, 0, 0);
      maskCtx.putImageData(maskData, 0, 0);

      wctx.globalCompositeOperation = 'source-over';
      wctx.clearRect(0, 0, work.width, work.height);
      wctx.drawImage(paper.canvas, 0, 0);
      wctx.globalCompositeOperation = 'source-atop';      // scorch, ember and char only land on paper
      wctx.drawImage(charCanvas, 0, 0, work.width, work.height);
      wctx.globalCompositeOperation = 'destination-out';  // burnt-away cells are erased
      wctx.drawImage(maskCanvas, 0, 0, work.width, work.height);
      wctx.globalCompositeOperation = 'source-over';
    }

    function count(perFrame, dt) {
      var x = perFrame * dt / 16.7;
      return Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);
    }

    function emit(dt) {
      if (!front.length || p <= 0.01 || p >= 0.995 || particles.length > 320) { return; }
      var n, k, spot;
      for (n = count(1.7, dt); n > 0; n--) {           // flame licks
        k = front[(Math.random() * front.length) | 0];
        spot = cellToScreen(k % gc, (k / gc) | 0);
        particles.push({ type: 'flame', x: spot.x, y: spot.y, vx: rand(-12, 12), vy: rand(-110, -60),
          life: rand(0.5, 0.95), age: 0, size: rand(26, 46) * Math.max(0.6, pose.scale * 2.2), seed: Math.random() * 6 });
      }
      for (n = count(0.9, dt); n > 0; n--) {           // embers
        k = front[(Math.random() * front.length) | 0];
        spot = cellToScreen(k % gc, (k / gc) | 0);
        particles.push({ type: 'ember', x: spot.x, y: spot.y, vx: rand(-14, 14), vy: rand(-95, -35),
          life: rand(1.4, 3.2), age: 0, size: rand(1.4, 3), seed: Math.random() * 6 });
      }
      for (n = count(0.5, dt); n > 0; n--) {           // ash
        k = front[(Math.random() * front.length) | 0];
        spot = cellToScreen(k % gc, (k / gc) | 0);
        particles.push({ type: 'ash', x: spot.x, y: spot.y, vx: rand(-10, 10), vy: rand(-55, -18),
          life: rand(2.4, 4.4), age: 0, size: rand(1.6, 3.6), seed: Math.random() * 6 });
      }
    }

    function updateParticles(dtMs) {
      var dt = dtMs / 1000;
      for (var n = particles.length - 1; n >= 0; n--) {
        var q = particles[n];
        q.age += dt;
        if (q.age >= q.life) { particles.splice(n, 1); continue; }
        q.x += (q.vx + Math.sin(q.age * 3 + q.seed) * (q.type === 'flame' ? 8 : 18)) * dt;
        q.y += q.vy * dt;
        if (q.type === 'ash') { q.vy += 26 * dt; }           // ash rises, then drifts back down
        if (q.type === 'ember') { q.vy -= 8 * dt; }
      }
    }

    function drawParticles() {
      var n, q, life, size;
      ctx.globalCompositeOperation = 'lighter';
      for (n = 0; n < particles.length; n++) {
        q = particles[n];
        life = q.age / q.life;
        if (q.type === 'flame') {                       // two stacked squares: orange, then yellow
          size = Math.max(px * 2, snap(q.size * 0.5));
          ctx.globalAlpha = 0.6 * Math.pow(1 - life, 1.2);
          ctx.fillStyle = 'rgb(240,118,42)';
          ctx.fillRect(snap(q.x) - size / 2, snap(q.y) - size / 2, size, size);
          ctx.fillStyle = 'rgb(255,214,106)';
          ctx.fillRect(snap(q.x) - size / 4, snap(q.y) - size / 4, size / 2, size / 2);
        } else if (q.type === 'ember') {
          ctx.globalAlpha = (1 - life) * (0.65 + 0.35 * Math.sin(q.age * 14 + q.seed));
          ctx.fillStyle = life < 0.5 ? '#ffd36a' : '#f0762a';
          ctx.fillRect(snap(q.x), snap(q.y), px, px);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgb(62,55,50)';
      for (n = 0; n < particles.length; n++) {
        q = particles[n];
        if (q.type !== 'ash') { continue; }
        ctx.globalAlpha = 0.75 * (1 - q.age / q.life);
        ctx.fillRect(snap(q.x), snap(q.y), px, px);
      }
      ctx.globalAlpha = 1;
    }

    // Forget the letter completely.
    function wipe() {
      paper.canvas.width = 0; paper.canvas.height = 0;
      work.width = 0; work.height = 0;
      maskCanvas.width = 0; charCanvas.width = 0;
      front.length = 0;
      paper = null;
    }

    function cleanup() {
      finished = true;
      cancelAnimationFrame(raf);
      if (paper) { wipe(); }
      particles.length = 0;
      if (screen.parentNode) { screen.parentNode.removeChild(screen); }
    }

    function render(time) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      if (paper && !gone) {
        updatePose(time);
        if (!opts.reduced) {
          updateCells(time);
        }
        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.rotate(pose.rot);
        ctx.transform(1, 0, pose.skew, 1, 0, 0);
        ctx.scale(pose.scale * pose.sx, pose.scale * pose.sy);
        ctx.globalAlpha = pose.alpha;
        if (elapsed < FLIGHT && !opts.reduced) {
          ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
        }
        ctx.drawImage(opts.reduced ? paper.canvas : work, -pw / 2, -ph / 2, pw, ph);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      if (!opts.reduced) { drawParticles(); }
    }

    function frame(now) {
      if (finished) { return; }
      if (!last) { last = now; }
      var dt = Math.min(50, now - last) * tScale;
      last = now;
      elapsed += dt;
      p = opts.reduced ? clamp(elapsed / 1600, 0, 1) : burnProgress();

      if (!opts.reduced && !ignited && elapsed >= FLIGHT) {
        ignited = true;
        if (opts.onIgnite) { opts.onIgnite(); }
      }
      if (!opts.reduced) { emit(dt); updateParticles(dt); }

      render(now);

      if (!gone && p >= 1) {                       // the paper is completely gone
        gone = true;
        wipe();
        ctx.clearRect(0, 0, vw, vh);
        if (opts.onDone) { opts.onDone(); }
      }
      if (gone) {                                  // let the last embers and ash drift away
        tail += dt;
        if (!particles.length || tail > 2500) { cleanup(); return; }
      }
      raf = requestAnimationFrame(frame);
    }

    // Draw the very first frame immediately, so the paper replaces the
    // preview sheet without a blink; then let the animation run.
    updatePose(0);
    if (!opts.reduced) { updateCells(0); }
    render(0);
    raf = requestAnimationFrame(frame);

    return {
      skip: function () { tScale = 9; },
      cancel: function () { cleanup(); }
    };
  }

  window.LetGoBurn = { start: start };
})();
