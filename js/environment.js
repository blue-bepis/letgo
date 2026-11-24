/**
 * Project Let Go — The Clearing
 * Phase 3: Environment Animation Engine
 *
 * Coordinates all subtle, organic environmental animations in a single
 * requestAnimationFrame loop:
 *  1. Sky: independent twinkling pixel stars + rare unpredictable shooting stars
 *  2. Lake: gentle pixel-strip water ripples & soft moonlight glimmers
 *  3. Campfire: layered procedural pixel-art flames, rising embers & tiny sparks
 *  4. Atmosphere: warm flickering campfire/lantern light pools & drifting fireflies
 *
 * Automatically pauses when the browser tab is hidden and respects
 * prefers-reduced-motion.
 */

(function () {
  const W = 1672;
  const H = 941;
  const PIX = 4; // Native pixel-art cluster size matching the reference artwork

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const skyCanvas = document.getElementById('fx-sky-canvas');
  const lakeCanvas = document.getElementById('fx-lake-canvas');
  const fireCanvas = document.getElementById('fx-fire-canvas');
  const ambientCanvas = document.getElementById('fx-ambient-canvas');

  if (!skyCanvas || !lakeCanvas || !fireCanvas || !ambientCanvas) return;

  const skyCtx = skyCanvas.getContext('2d');
  const lakeCtx = lakeCanvas.getContext('2d');
  const fireCtx = fireCanvas.getContext('2d');
  const ambientCtx = ambientCanvas.getContext('2d');

  [skyCtx, lakeCtx, fireCtx, ambientCtx].forEach((ctx) => {
    ctx.imageSmoothingEnabled = false;
  });

  // Deterministic pseudo-random helper so initial placement is harmonious
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20261123);

  function snap(v) {
    return Math.round(v / PIX) * PIX;
  }

  // ==========================================================================
  // 1. NIGHT SKY: Twinkling Stars & Rare Shooting Stars
  // ==========================================================================
  const stars = [];
  for (let i = 0; i < 46; i++) {
    const x = snap(140 + rng() * 1380);
    const y = snap(18 + rng() * 310);
    // Keep clear of the moon disk (651, 165, r=85) and outer tree trunks
    const dm = Math.hypot(x - 651, y - 165);
    if (dm < 96) continue;
    if (x < 330 && y < 165) continue;
    if (x > 1300 && y < 200) continue;

    const isSparkle = i < 8;
    stars.push({
      x,
      y,
      isSparkle,
      phase: rng() * Math.PI * 2,
      speed: 0.45 + rng() * 1.15,
      minA: isSparkle ? 0.25 : 0.12,
      maxA: isSparkle ? 0.92 : 0.65,
      tint: rng() > 0.35 ? '#fff2d6' : '#cfe2ff',
    });
  }

  let shootingStar = null;
  let nextShootingStarAt = 5.5; // First gentle appearance ~5.5s in, then rare 14–28s intervals

  function spawnShootingStar(nowSec) {
    const startX = 960 + rng() * 240;
    const startY = 48 + rng() * 65;
    const angle = (146 + rng() * 12) * (Math.PI / 180); // Down-left like reference
    const speed = 320 + rng() * 110;
    shootingStar = {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      duration: 0.95 + rng() * 0.45,
      trailLen: 145 + rng() * 55,
    };
    nextShootingStarAt = nowSec + 14 + rng() * 15;
  }

  function renderSky(t, dt) {
    skyCtx.clearRect(0, 0, W, 430);

    // Subtle moon aura breath
    const moonPulse = 0.09 + Math.sin(t * 0.45) * 0.025;
    const mGrad = skyCtx.createRadialGradient(651, 165, 58, 651, 165, 165);
    mGrad.addColorStop(0, `rgba(255, 224, 174, ${moonPulse.toFixed(3)})`);
    mGrad.addColorStop(1, 'rgba(255, 224, 174, 0)');
    skyCtx.fillStyle = mGrad;
    skyCtx.fillRect(480, 0, 345, 340);

    // Twinkling stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const wave = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      const alpha = s.minA + (s.maxA - s.minA) * (wave * wave);
      skyCtx.globalAlpha = alpha;
      skyCtx.fillStyle = s.tint;

      if (s.isSparkle) {
        // 4-point pixel-art sparkle cross
        skyCtx.fillRect(s.x, s.y, PIX, PIX);
        skyCtx.globalAlpha = alpha * 0.55;
        skyCtx.fillRect(s.x - PIX, s.y, PIX, PIX);
        skyCtx.fillRect(s.x + PIX, s.y, PIX, PIX);
        skyCtx.fillRect(s.x, s.y - PIX, PIX, PIX);
        skyCtx.fillRect(s.x, s.y + PIX, PIX, PIX);
      } else {
        skyCtx.fillRect(s.x, s.y, PIX, PIX);
      }
    }
    skyCtx.globalAlpha = 1;

    // Rare shooting star
    if (!shootingStar && t >= nextShootingStarAt) {
      spawnShootingStar(t);
    }
    if (shootingStar) {
      shootingStar.age += dt;
      shootingStar.x += shootingStar.vx * dt;
      shootingStar.y += shootingStar.vy * dt;

      const p = shootingStar.age / shootingStar.duration;
      if (p >= 1) {
        shootingStar = null;
      } else {
        const fade = p < 0.2 ? p / 0.2 : Math.max(0, 1 - (p - 0.2) / 0.8);
        const speedMag = Math.hypot(shootingStar.vx, shootingStar.vy);
        const dx = -shootingStar.vx / speedMag;
        const dy = -shootingStar.vy / speedMag;

        // Draw crisp pixel-stepped fading tail
        const steps = 26;
        for (let i = 0; i < steps; i++) {
          const frac = i / steps;
          const px = snap(shootingStar.x + dx * frac * shootingStar.trailLen);
          const py = snap(shootingStar.y + dy * frac * shootingStar.trailLen);
          const a = fade * (1 - frac) * (1 - frac) * 0.85;
          if (a < 0.03) continue;
          skyCtx.globalAlpha = a;
          skyCtx.fillStyle = i < 3 ? '#fff7e0' : '#d8c8f0';
          skyCtx.fillRect(px, py, PIX, PIX);
        }

        // Glowing pixel cross head
        const hx = snap(shootingStar.x);
        const hy = snap(shootingStar.y);
        skyCtx.globalAlpha = fade;
        skyCtx.fillStyle = '#fff9e6';
        skyCtx.fillRect(hx, hy, PIX, PIX);
        skyCtx.globalAlpha = fade * 0.5;
        skyCtx.fillRect(hx - PIX, hy, PIX, PIX);
        skyCtx.fillRect(hx + PIX, hy, PIX, PIX);
        skyCtx.fillRect(hx, hy - PIX, PIX, PIX);
        skyCtx.fillRect(hx, hy + PIX, PIX, PIX);
        skyCtx.globalAlpha = 1;
      }
    }
  }

  // ==========================================================================
  // 2. LAKE: Gentle Horizontal Scanline Ripples & Water Glimmers
  // ==========================================================================
  let lakeImg = null;
  let lakeReady = false;
  const LAKE_Y = 522;
  const LAKE_H = 183;

  const glimmers = [];
  for (let i = 0; i < 16; i++) {
    // Concentrate glimmers near moon reflection (560..710) and lantern reflection (455..520)
    const inMoonCol = i < 11;
    const x = inMoonCol
      ? snap(575 + rng() * 120)
      : snap(455 + rng() * 70);
    const y = snap(530 + rng() * 145);
    glimmers.push({
      x,
      y,
      w: PIX * (1 + Math.floor(rng() * 3)),
      phase: rng() * Math.PI * 2,
      speed: 0.8 + rng() * 1.1,
      color: inMoonCol ? '#ffe2b8' : '#ffb86c',
    });
  }

  function bindLakeSource() {
    const el = document.getElementById('layer-lake_base');
    if (!el) return;
    if (el.complete && el.naturalWidth > 0) {
      lakeImg = el;
      lakeReady = true;
      if (!reducedMotion) {
        el.style.opacity = '0';
      }
    } else {
      el.addEventListener('load', () => {
        lakeImg = el;
        lakeReady = true;
        if (!reducedMotion) {
          el.style.opacity = '0';
        }
      });
    }
  }

  function renderLake(t) {
    if (!lakeReady || !lakeImg) return;
    lakeCtx.clearRect(0, LAKE_Y - 2, W, LAKE_H + 6);

    const stripH = 3;
    const srcH = lakeImg.naturalHeight;
    const srcW = lakeImg.naturalWidth;

    for (let sy = 0; sy < srcH; sy += stripH) {
      const depth = sy / srcH; // 0 at far horizon -> 1 near foreground shore
      const sh = Math.min(stripH, srcH - sy);
      const amp = 0.6 + depth * 2.1;
      const shift =
        Math.sin(t * 1.15 + sy * 0.16) * amp +
        Math.sin(t * 0.62 - sy * 0.08) * (amp * 0.45);
      const dx = Math.round(shift);
      lakeCtx.drawImage(lakeImg, 0, sy, srcW, sh, dx, LAKE_Y + sy, W, sh);
    }

    // Occasional soft pixel glimmers across the reflected light
    for (let i = 0; i < glimmers.length; i++) {
      const g = glimmers[i];
      const pulse = Math.sin(t * g.speed + g.phase);
      if (pulse <= 0.45) continue;
      const a = ((pulse - 0.45) / 0.55) * 0.48;
      lakeCtx.globalAlpha = a;
      lakeCtx.fillStyle = g.color;
      lakeCtx.fillRect(g.x + Math.round(Math.sin(t + g.phase) * 2), g.y, g.w, 2);
    }
    lakeCtx.globalAlpha = 1;
  }

  // ==========================================================================
  // 3. CAMPFIRE: Organic Pixel-Art Flames, Rising Embers & Sparks
  // ==========================================================================
  const FIRE_CX = 822;
  const FIRE_BASE_Y = 768;

  // 8 overlapping organic flame tongues matching the reference campfire height & fullness
  const tongues = [
    { ox: -64, baseW: 34, maxH: 115, speed: 3.0, phase: 0.4, sway: 10 },
    { ox: -38, baseW: 50, maxH: 185, speed: 2.5, phase: 1.7, sway: 14 },
    { ox: -10, baseW: 62, maxH: 255, speed: 2.2, phase: 0.0, sway: 16 },
    { ox: 16,  baseW: 54, maxH: 218, speed: 2.6, phase: 2.6, sway: 14 },
    { ox: 46,  baseW: 42, maxH: 145, speed: 3.1, phase: 4.1, sway: 11 },
    { ox: 68,  baseW: 28, maxH: 98,  speed: 3.5, phase: 1.1, sway: 8 },
    { ox: -22, baseW: 42, maxH: 168, speed: 3.3, phase: 3.2, sway: 13 },
    { ox: 28,  baseW: 38, maxH: 152, speed: 3.5, phase: 5.0, sway: 11 },
  ];

  // Rising pixel embers & occasional sparks
  const embers = [];
  function spawnEmber(initial) {
    const isSpark = rng() < 0.25;
    return {
      x: FIRE_CX + (rng() - 0.5) * 92,
      y: initial ? FIRE_BASE_Y - 40 - rng() * 260 : FIRE_BASE_Y - 25 - rng() * 55,
      vy: -(24 + rng() * (isSpark ? 52 : 28)),
      vxBase: (rng() - 0.5) * 14,
      wobbleAmp: 6 + rng() * 14,
      wobbleFreq: 1.2 + rng() * 1.8,
      phase: rng() * Math.PI * 2,
      life: initial ? rng() * 2.5 : 0,
      maxLife: isSpark ? (1.1 + rng() * 0.9) : (2.4 + rng() * 2.2),
      size: isSpark ? PIX : (rng() > 0.65 ? PIX + 2 : PIX),
      isSpark,
    };
  }
  for (let i = 0; i < 22; i++) embers.push(spawnEmber(true));

  // Reusable small pixel buffer for crisp quantized pixel-art fire
  const FIRE_X0 = 700;
  const FIRE_Y0 = 460;
  const FIRE_W = 248;
  const FIRE_H = 320;
  const COLS = Math.ceil(FIRE_W / PIX);
  const ROWS = Math.ceil(FIRE_H / PIX);

  function hideStaticFlames() {
    const el = document.getElementById('layer-campfire_flames');
    if (el && !reducedMotion) {
      el.style.opacity = '0';
    }
  }

  function renderCampfire(t, dt) {
    fireCtx.clearRect(FIRE_X0 - 20, FIRE_Y0 - 60, FIRE_W + 40, FIRE_H + 80);

    // Evaluate organic pixel-grid fire field
    for (let r = 0; r < ROWS; r++) {
      const py = FIRE_Y0 + r * PIX;
      const distFromBase = FIRE_BASE_Y - py;
      if (distFromBase < -8) continue;

      for (let c = 0; c < COLS; c++) {
        const px = FIRE_X0 + c * PIX;
        let heat = 0;

        for (let k = 0; k < tongues.length; k++) {
          const tg = tongues[k];
          const hMod =
            0.84 +
            0.16 * Math.sin(t * tg.speed + tg.phase) +
            0.09 * Math.sin(t * (tg.speed * 1.73) + tg.phase * 2.1);
          const curH = tg.maxH * hMod;
          if (distFromBase < -6 || distFromBase > curH) continue;

          const u = Math.max(0, distFromBase / curH); // 0 at logs -> 1 at tip
          const swayX =
            Math.sin(t * (tg.speed * 0.92) + tg.phase - u * 4.4) * tg.sway * u +
            Math.sin(t * 4.2 + u * 7.0 + k) * 3.5 * u * u;
          const centerX = FIRE_CX + tg.ox * (1 - u * 0.55) + swayX;
          const halfW = tg.baseW * (1 - Math.pow(u, 1.35)) * (0.85 + 0.15 * Math.sin(u * 6 - t * 3 + k));
          if (halfW <= 1) continue;

          const dx = Math.abs(px - centerX);
          if (dx < halfW) {
            const local = (1 - (dx / halfW) * (dx / halfW)) * (1 - u * 0.88);
            if (local > heat) heat = local;
          }
        }

        // Subtle pixel-art dither breakup near flame tips
        if (heat > 0.14 && heat < 0.34) {
          const dither = Math.sin(c * 1.9 + r * 2.3 + Math.floor(t * 7) * 1.7);
          if (dither > 0.35) heat -= 0.12;
        }

        if (heat < 0.16) continue;

        // Rounded curved hearth base hugging the crossed logs (no flat bottom edge!)
        const rxBase = (px - FIRE_CX) / 96;
        const logCurveY = 768 - rxBase * rxBase * 34 + Math.sin(px * 0.08 + t * 2.5) * 4;
        if (py > logCurveY - 26) {
          const bottomFade = Math.max(0, (logCurveY - py) / 26);
          heat *= bottomFade;
          if (heat < 0.16) continue;
        }

        // Reference-matched warm pixel-art fire palette
        let color;
        if (heat > 0.78) {
          color = '#fff6cc'; // bright yellow-white core
        } else if (heat > 0.58) {
          color = '#ffdc6b'; // warm golden yellow
        } else if (heat > 0.38) {
          color = '#ff962e'; // rich amber orange
        } else if (heat > 0.24) {
          color = '#e65419'; // deep flame orange
        } else {
          color = '#a62d17'; // outer ember crimson-orange
        }

        fireCtx.fillStyle = color;
        fireCtx.fillRect(px, py, PIX, PIX);
      }
    }

    // Rising embers & occasional tiny sparks
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.life += dt;
      if (e.life >= e.maxLife || e.y < 410) {
        embers[i] = spawnEmber(false);
        continue;
      }
      e.y += e.vy * dt;
      e.x += (e.vxBase + Math.sin(t * e.wobbleFreq + e.phase) * e.wobbleAmp) * dt;

      const p = e.life / e.maxLife;
      const alpha = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85);
      const ex = snap(e.x);
      const ey = snap(e.y);

      fireCtx.globalAlpha = alpha * (e.isSpark ? 0.95 : 0.85);
      fireCtx.fillStyle = p < 0.3 ? '#ffe88a' : (p < 0.65 ? '#ff9933' : '#d94818');
      fireCtx.fillRect(ex, ey, e.size, e.size);
    }
    fireCtx.globalAlpha = 1;
  }

  // ==========================================================================
  // 4. AMBIENT LIGHTING & DRIFTING FIREFLIES
  // ==========================================================================
  const fireflyZones = [
    { x: 185, y: 295, rx: 65, ry: 55 },
    { x: 255, y: 565, rx: 85, ry: 55 },
    { x: 415, y: 615, rx: 90, ry: 45 },
    { x: 935, y: 615, rx: 70, ry: 45 },
    { x: 1445, y: 445, rx: 85, ry: 75 },
    { x: 1505, y: 535, rx: 85, ry: 65 },
    { x: 1585, y: 585, rx: 55, ry: 65 },
    { x: 340, y: 505, rx: 75, ry: 40 },
    { x: 1380, y: 365, rx: 75, ry: 55 },
    { x: 115, y: 605, rx: 55, ry: 50 },
    { x: 1030, y: 500, rx: 65, ry: 45 },
    { x: 1470, y: 625, rx: 65, ry: 45 },
  ];

  const fireflies = fireflyZones.map((z) => ({
    cx: z.x,
    cy: z.y,
    rx: z.rx,
    ry: z.ry,
    p1: rng() * Math.PI * 2,
    p2: rng() * Math.PI * 2,
    s1: 0.22 + rng() * 0.28,
    s2: 0.18 + rng() * 0.25,
    glowPhase: rng() * Math.PI * 2,
    glowSpeed: 0.55 + rng() * 0.65,
  }));

  function renderAmbient(t) {
    ambientCtx.clearRect(0, 0, W, H);

    // Subtle organic warm campfire light fluctuation on foreground rocks, grass, knees & bear
    const fireFlicker =
      0.5 +
      0.28 * Math.sin(t * 3.1) +
      0.14 * Math.sin(t * 6.7 + 1.2) +
      0.08 * Math.sin(t * 11.3 + 2.5);

    ambientCtx.save();
    ambientCtx.globalCompositeOperation = 'lighter';

    // Warm campfire illumination pool
    const cfAlpha = 0.055 + fireFlicker * 0.065;
    const cfGrad = ambientCtx.createRadialGradient(822, 725, 25, 822, 725, 420);
    cfGrad.addColorStop(0, `rgba(255, 168, 66, ${(cfAlpha * 1.45).toFixed(3)})`);
    cfGrad.addColorStop(0.45, `rgba(240, 118, 36, ${(cfAlpha * 0.65).toFixed(3)})`);
    cfGrad.addColorStop(1, 'rgba(240, 118, 36, 0)');
    ambientCtx.fillStyle = cfGrad;
    ambientCtx.fillRect(390, 320, 860, 621);

    // Gentle hanging lantern warmth pulse
    const hlAlpha = 0.06 + Math.sin(t * 2.4 + 0.7) * 0.025;
    const hlGrad = ambientCtx.createRadialGradient(188, 452, 8, 188, 452, 130);
    hlGrad.addColorStop(0, `rgba(255, 186, 88, ${hlAlpha.toFixed(3)})`);
    hlGrad.addColorStop(1, 'rgba(255, 150, 48, 0)');
    ambientCtx.fillStyle = hlGrad;
    ambientCtx.fillRect(55, 320, 265, 265);

    // Gentle standing ground lantern warmth pulse
    const slAlpha = 0.065 + Math.sin(t * 2.1 + 2.1) * 0.025;
    const slGrad = ambientCtx.createRadialGradient(225, 760, 12, 225, 760, 170);
    slGrad.addColorStop(0, `rgba(255, 182, 80, ${slAlpha.toFixed(3)})`);
    slGrad.addColorStop(1, 'rgba(255, 145, 40, 0)');
    ambientCtx.fillStyle = slGrad;
    ambientCtx.fillRect(50, 585, 350, 355);

    ambientCtx.restore();


    /* Mug steam wisp */
    for (let i = 0; i < 3; i++) {
      const sp = (t * 0.24 + i * 0.33) % 1;
      const sx = snap(1332 + Math.sin(t * 1.1 + i * 2.1 + sp * 4) * 5);
      const sy = snap(718 - sp * 34);
      const sa = Math.sin(sp * Math.PI) * 0.22;
      if (sa > 0.02) {
        ambientCtx.globalAlpha = sa;
        ambientCtx.fillStyle = '#ffe9cc';
        ambientCtx.fillRect(sx, sy, PIX, PIX);
      }
    }
    ambientCtx.globalAlpha = 1;

    // Floating pixel-art fireflies
    for (let i = 0; i < fireflies.length; i++) {
      const f = fireflies[i];
      const glow = 0.5 + 0.5 * Math.sin(t * f.glowSpeed + f.glowPhase);
      const a = Math.pow(glow, 1.6);
      if (a < 0.06) continue;

      const fx = f.cx + Math.sin(t * f.s1 + f.p1) * f.rx * 0.45 + Math.cos(t * f.s2 * 0.7 + f.p2) * f.rx * 0.25;
      const fy = f.cy + Math.cos(t * f.s2 + f.p2) * f.ry * 0.45 + Math.sin(t * f.s1 * 0.8 + f.p1) * f.ry * 0.2;
      const sx = snap(fx);
      const sy = snap(fy);

      // Soft warm glowing halo
      const halo = ambientCtx.createRadialGradient(sx + 2, sy + 2, 1, sx + 2, sy + 2, 22);
      halo.addColorStop(0, `rgba(255, 214, 112, ${(a * 0.34).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(255, 175, 64, 0)');
      ambientCtx.fillStyle = halo;
      ambientCtx.fillRect(sx - 20, sy - 20, 44, 44);

      // Crisp pixel-art '+' core matching reference fireflies
      ambientCtx.globalAlpha = a * 0.95;
      ambientCtx.fillStyle = '#fff3b8';
      ambientCtx.fillRect(sx, sy, PIX, PIX);
      ambientCtx.globalAlpha = a * 0.55;
      ambientCtx.fillStyle = '#ffb852';
      ambientCtx.fillRect(sx - PIX, sy, PIX, PIX);
      ambientCtx.fillRect(sx + PIX, sy, PIX, PIX);
      ambientCtx.fillRect(sx, sy - PIX, PIX, PIX);
      ambientCtx.fillRect(sx, sy + PIX, PIX, PIX);
      ambientCtx.globalAlpha = 1;
    }
  }

  // ==========================================================================
  // MASTER LOOP (with visibility pause & reduced-motion support)
  // ==========================================================================
  let rafId = null;
  let lastTs = null;
  let elapsed = 0;

  function tick(ts) {
    if (document.hidden) {
      rafId = null;
      lastTs = null;
      return;
    }
    if (lastTs === null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    elapsed += dt;

    renderSky(elapsed, dt);
    renderLake(elapsed);
    renderCampfire(elapsed, dt);
    renderAmbient(elapsed);

    rafId = window.requestAnimationFrame(tick);
  }

  function start() {
    bindLakeSource();
    if (reducedMotion) {
      // Render a calm single frame of stars & gentle ambient glow without motion
      renderSky(1.2, 0);
      renderAmbient(1.2);
      return;
    }
    hideStaticFlames();
    if (!rafId) {
      lastTs = null;
      rafId = window.requestAnimationFrame(tick);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastTs = null;
    } else if (!reducedMotion && !rafId) {
      rafId = window.requestAnimationFrame(tick);
    }
  });

  // Allow Phase 6 sky transition to trigger a dedicated cinematic shooting star
  window.LetGoSkyFX = {
    triggerShootingStar: function () {
      spawnShootingStar(elapsed);
    }
  };

  // Start once scene.js has mounted the DOM layers
  window.addEventListener('letgo:layers-ready', start);
  // Fallback in case layers already mounted
  if (document.getElementById('layer-lake_base')) {
    start();
  }
})();
