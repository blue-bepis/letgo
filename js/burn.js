/**
 * Project Let Go — The Clearing
 * Phase 7+: First-Person POV Paper Toss & Campfire Burn Engine
 *
 * 1. Renders an actual physical firelit paper sheet with the visitor's real words.
 * 2. Smoothly pulls it down into the visitor's bottom-center POV hands.
 * 3. Tosses the paper forward in a true perspective parabolic arc straight down
 *    onto the glowing campfire logs at (fire.cx, fire.cy).
 * 4. Ignites and burns the paper pixel-by-pixel right inside the flames into
 *    glowing amber embers, black char, and rising ash, then wipes all buffers.
 */

(function () {
  'use strict';

  const canvas = document.getElementById('burn-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function wrapLines(g, text, maxW, maxLines) {
    const lines = [];
    const paras = text.replace(/\r/g, '').split('\n');
    for (let p = 0; p < paras.length; p++) {
      const par = paras[p];
      if (!par.trim()) {
        lines.push('');
      } else {
        const words = par.split(' ');
        let line = '';
        for (let w = 0; w < words.length; w++) {
          const word = words[w];
          const test = line ? line + ' ' + word : word;
          if (g.measureText(test).width <= maxW) {
            line = test;
          } else {
            if (line) lines.push(line);
            line = word;
          }
        }
        if (line) lines.push(line);
      }
      if (lines.length >= maxLines) break;
    }
    return lines.slice(0, maxLines);
  }

  function buildPaperCanvas(text, pw, ph) {
    const off = document.createElement('canvas');
    off.width = pw;
    off.height = ph;
    const g = off.getContext('2d');
    g.imageSmoothingEnabled = false;

    const paperBgEl = document.getElementById('letter-paper-bg');
    if (paperBgEl && paperBgEl.complete && paperBgEl.naturalWidth > 0) {
      // Draw our handcrafted torn, stained pixel-art parchment sprite!
      g.drawImage(paperBgEl, 0, 0, pw, ph);
    } else {
      g.fillStyle = '#e8d5b3';
      g.fillRect(0, 0, pw, ph);
    }

    // Render visitor's actual words in dark sepia ink
    const pad = Math.min(44, Math.round(pw * 0.095));
    const fontPx = Math.min(20, Math.max(15, Math.round(pw * 0.036)));
    const lh = fontPx * 1.62;
    g.font = `${Math.max(13, fontPx - 2)}px "Cinzel Decorative", Georgia, "Times New Roman", serif`;
    g.fillStyle = '#2b1e16';
    g.textBaseline = 'top';

    const lines = wrapLines(g, text, pw - pad * 2, Math.floor((ph - pad * 2) / lh));
    for (let i = 0; i < lines.length; i++) {
      g.fillText(lines[i], pad, pad + i * lh);
    }

    return off;
  }

  function startBurn(opts) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width = vw;
    canvas.height = vh;
    ctx.imageSmoothingEnabled = false;

    const fire = opts.fire;
    const pix = Math.max(3, fire.pix || 4);
    const reduced = !!opts.reduced;

    // Match the on-screen paper size cleanly
    const pw = opts.paperRect && opts.paperRect.width > 120
      ? Math.round(opts.paperRect.width)
      : Math.min(540, vw - 48);
    const ph = opts.paperRect && opts.paperRect.height > 120
      ? Math.round(opts.paperRect.height)
      : Math.min(300, Math.round(vh * 0.42));

    const paperCanvas = buildPaperCanvas(opts.text, pw, ph);

    // Precompute ragged burn-time grid over the paper (24x16 cells -> super fast & organic)
    const gCols = 26;
    const gRows = 16;
    const cellW = pw / gCols;
    const cellH = ph / gRows;
    const burnGrid = new Float32Array(gCols * gRows);
    for (let r = 0; r < gRows; r++) {
      for (let c = 0; c < gCols; c++) {
        // Burn inward from bottom and outer edges with organic ragged noise
        const fromBottom = 1 - r / (gRows - 1);
        const fromEdge = Math.abs(c / (gCols - 1) - 0.5) * 2;
        const noise = Math.sin(c * 0.8 + r * 0.5) * 0.09 + Math.random() * 0.22;
        burnGrid[r * gCols + c] = Math.max(0.02, Math.min(0.92, fromBottom * 0.55 + fromEdge * 0.25 + noise));
      }
    }

    // Working canvas updated during burn phase
    const burnCanvas = document.createElement('canvas');
    burnCanvas.width = pw;
    burnCanvas.height = ph;
    const bg = burnCanvas.getContext('2d');
    bg.drawImage(paperCanvas, 0, 0);

    // Start right where #letter-paper was on screen
    const startCx = opts.paperRect ? (opts.paperRect.left + opts.paperRect.width / 2) : vw / 2;
    const startCy = opts.paperRect ? (opts.paperRect.top + opts.paperRect.height / 2) : vh * 0.46;

    // POV hand launch point (bottom-center foreground, right between Mina's knees!)
    const handCx = vw * 0.5;
    const handCy = vh * 0.86;

    // EXACT campfire hearth center (right on top of the crossed burning logs!)
    const landCx = fire.cx;
    const landCy = fire.cy;

    // Target paper size inside the campfire logs (~135px wide on desktop, scaled naturally)
    const targetScale = Math.max(0.18, Math.min(0.32, (fire.w * 0.78) / pw));

    const GRAB_MS = reduced ? 150 : 420;   // Pull letter slightly down into POV hands
    const TOSS_MS = reduced ? 350 : 1250;  // Parabolic POV throw directly into campfire logs
    const BURN_MS = reduced ? 1200 : 5800; // Pixel-art burn right inside the flames
    const TAIL_MS = reduced ? 200 : 1100;  // Rising embers & ash finish

    const particles = [];
    let elapsed = 0;
    let lastTs = null;
    let rafId = 0;
    let speedMult = 1;
    let landed = false;
    let ignited = false;
    let finished = false;

    function wipeAll() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bg.clearRect(0, 0, pw, ph);
      paperCanvas.width = 1;
      paperCanvas.height = 1;
      burnCanvas.width = 1;
      burnCanvas.height = 1;
      particles.length = 0;
    }

    function finish() {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(rafId);
      wipeAll();
      if (opts.onDone) opts.onDone();
    }

    function step(ts) {
      if (finished) return;
      if (lastTs === null) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000) * speedMult;
      lastTs = ts;
      elapsed += dt * 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let cx = startCx;
      let cy = startCy;
      let scaleX = 1;
      let scaleY = 1;
      let rot = -0.008;

      if (elapsed < GRAB_MS) {
        // Phase 1: Pull paper slightly down & inward toward our POV hands
        const u = easeInOut(elapsed / GRAB_MS);
        cx = startCx + (handCx - startCx) * (u * 0.65);
        cy = startCy + (handCy - startCy) * (u * 0.62);
        scaleX = 1 - u * 0.14;
        scaleY = 1 - u * 0.24; // slight forward perspective tilt
        rot = -0.008 + u * 0.05;
      } else if (elapsed < GRAB_MS + TOSS_MS) {
        // Phase 2: True first-person POV parabolic toss straight into the campfire logs!
        const u = (elapsed - GRAB_MS) / TOSS_MS;
        const e = easeOutCubic(u);
        const grabX = startCx + (handCx - startCx) * 0.65;
        const grabY = startCy + (handCy - startCy) * 0.62;

        // Parabolic upward arc peaking mid-flight then dropping cleanly into the fire hearth
        const arcLift = Math.sin(u * Math.PI) * Math.min(180, vh * 0.24);
        cx = grabX + (landCx - grabX) * e;
        cy = grabY + (landCy - grabY) * e - arcLift;

        // Perspective shrinking + flattening horizontally as it lands on the logs!
        scaleX = 0.86 + (targetScale - 0.86) * e;
        scaleY = 0.76 + (targetScale * 0.56 - 0.76) * e;
        rot = 0.042 + Math.sin(u * Math.PI * 1.15) * 0.22 - u * 0.16;
      } else {
        // Phase 3: Resting squarely on the burning campfire logs & dissolving into embers!
        if (!landed) {
          landed = true;
          if (opts.onLand) opts.onLand();
        }
        cx = landCx;
        cy = landCy;
        scaleX = targetScale;
        scaleY = targetScale * 0.56;
        rot = -0.11;

        const burnP = Math.min(1.3, (elapsed - GRAB_MS - TOSS_MS) / BURN_MS);
        if (burnP > 0.05 && !ignited) {
          ignited = true;
          if (opts.onIgnite) opts.onIgnite();
        }

        // Redraw fresh paper into burnCanvas then apply pixel-art scorch/ember/char/erase mask
        bg.clearRect(0, 0, pw, ph);
        bg.drawImage(paperCanvas, 0, 0);

        for (let r = 0; r < gRows; r++) {
          for (let c = 0; c < gCols; c++) {
            const age = burnP - burnGrid[r * gCols + c];
            if (age <= 0) continue;

            const rx = Math.floor(c * cellW);
            const ry = Math.floor(r * cellH);
            const rw = Math.ceil(cellW) + 1;
            const rh = Math.ceil(cellH) + 1;

            if (age < 0.09) {
              // Warm toasted brown scorch (source-atop keeps torn edges crisp!)
              bg.globalCompositeOperation = 'source-atop';
              bg.fillStyle = 'rgba(120, 62, 22, 0.58)';
              bg.fillRect(rx, ry, rw, rh);
              bg.globalCompositeOperation = 'source-over';
            } else if (age < 0.18) {
              // Bright glowing campfire ember line
              bg.globalCompositeOperation = 'source-atop';
              bg.fillStyle = age < 0.13 ? '#ff9d2e' : '#ffe885';
              bg.fillRect(rx, ry, rw, rh);
              bg.globalCompositeOperation = 'source-over';
              if (Math.random() < 0.14) {
                const wx = cx + (rx - pw / 2) * scaleX;
                const wy = cy + (ry - ph / 2) * scaleY;
                particles.push({
                  x: wx,
                  y: wy,
                  vx: (Math.random() - 0.5) * 38,
                  vy: -(48 + Math.random() * 75),
                  life: 0,
                  maxLife: 0.9 + Math.random() * 1.4,
                  wobble: Math.random() * Math.PI * 2,
                  isAsh: Math.random() < 0.3
                });
              }
            } else if (age < 0.25) {
              // Black char before crumbling away
              bg.globalCompositeOperation = 'source-atop';
              bg.fillStyle = '#231314';
              bg.fillRect(rx, ry, rw, rh);
              bg.globalCompositeOperation = 'source-over';
            } else {
              // Burned away completely
              bg.clearRect(rx, ry, rw, rh);
            }
          }
        }
      }

      // Draw the paper sheet onto the screen (with subtle warm glow once inside the fire!)
      if (elapsed < GRAB_MS + TOSS_MS + BURN_MS * 1.15) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.scale(scaleX, scaleY);
        if (landed) {
          ctx.shadowColor = 'rgba(255, 148, 38, 0.75)';
          ctx.shadowBlur = 18;
        } else {
          ctx.shadowColor = 'rgba(5, 8, 20, 0.55)';
          ctx.shadowBlur = 24;
        }
        ctx.drawImage(burnCanvas, -pw / 2, -ph / 2);
        ctx.restore();
      }

      // Draw rising pixel-art embers & ash floating straight up from the campfire
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(p.life * 3.8 + p.wobble) * 18) * dt;
        const t = p.life / p.maxLife;
        const a = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
        ctx.globalAlpha = a * 0.94;
        ctx.fillStyle = p.isAsh ? '#85788f' : (t < 0.35 ? '#fff0a0' : (t < 0.7 ? '#ff932b' : '#b83518'));
        ctx.fillRect(Math.round(p.x / pix) * pix, Math.round(p.y / pix) * pix, pix, pix);
      }
      ctx.globalAlpha = 1;

      if (elapsed >= GRAB_MS + TOSS_MS + BURN_MS + TAIL_MS && particles.length === 0) {
        finish();
      } else {
        rafId = requestAnimationFrame(step);
      }
    }

    rafId = requestAnimationFrame(step);

    return {
      skip: function () { speedMult = 4.5; },
      cancel: finish
    };
  }

  window.LetGoBurn = { start: startBurn };
})();
