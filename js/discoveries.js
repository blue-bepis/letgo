/**
 * Project Let Go — The Clearing
 * Phase 7: Quiet Interactions & Small Woodland Discoveries
 *
 * Strictly non-game philosophy: zero scores, zero checklists, zero popups.
 * Just gentle tactile moments for visitors who linger and explore.
 */

(function () {
  'use strict';

  const W = 1672;
  const H = 941;
  const PIX = 4;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.getElementById('fx-discoveries-canvas');
  const stage = document.getElementById('scene-stage');
  if (!canvas || !stage) return;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function snap(v) { return Math.round(v / PIX) * PIX; }

  // Active discovery particle collections
  const sparks = [];
  const ripples = [];

  // Shy woodland owl visiting the upper-left tree canopy (x=256, y=108)
  const owl = {
    active: false,
    x: 256,
    y: 112,
    age: 0,
    duration: 22,
    nextVisitAt: 18,
    blinkTimer: 2.8,
    blinking: false
  };

  // Gentle curious firefly following soft pointer presence over the clearing
  const cursorFly = {
    x: 520,
    y: 660,
    tx: 520,
    ty: 660,
    alpha: 0,
    activeUntil: 0
  };

  let nextLakeFishAt = 11;

  function spawnEmberBurst(cx, cy, count) {
    for (let i = 0; i < count; i++) {
      sparks.push({
        x: cx + (Math.random() - 0.5) * 76,
        y: cy + (Math.random() - 0.5) * 34,
        vx: (Math.random() - 0.5) * 44,
        vy: -(48 + Math.random() * 78),
        life: 0,
        maxLife: 1.1 + Math.random() * 1.4,
        wobble: Math.random() * Math.PI * 2,
        warm: true
      });
    }
  }

  function spawnSparkle(cx, cy, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 16 + Math.random() * 34;
      sparks.push({
        x: cx + (Math.random() - 0.5) * 18,
        y: cy + (Math.random() - 0.5) * 18,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 12,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.7,
        wobble: Math.random() * Math.PI * 2,
        warm: false
      });
    }
  }

  function spawnRipple(x, y, maxR) {
    ripples.push({
      x,
      y,
      age: 0,
      duration: 2.6 + Math.random() * 0.8,
      maxR: maxR || (34 + Math.random() * 18)
    });
  }

  // Convert client pointer event into exact 1672x941 stage coordinates
  function clientToStage(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H
    };
  }

  // Tactile clicks anywhere in the clearing (only when sitting in the campsite)
  window.addEventListener('click', (e) => {
    if (reducedMotion) return;
    if (document.body.getAttribute('data-state') !== 'campsite') return;
    // Ignore clicks on buttons, sound popover, or bear hitbox
    if (e.target && e.target.closest && e.target.closest('button, .sound-popover, .bear-offer-prompt')) return;

    const pt = clientToStage(e.clientX, e.clientY);
    if (!pt) return;

    // 1. Campfire area: stoke gentle burst of golden embers
    if (pt.x >= 680 && pt.x <= 965 && pt.y >= 560 && pt.y <= 845) {
      spawnEmberBurst(822, 690, 16);
      return;
    }

    // 2. Lake surface: gentle moonlit concentric water ripple
    if (pt.x >= 230 && pt.x <= 1040 && pt.y >= 526 && pt.y <= 682) {
      spawnRipple(pt.x, pt.y, 44);
      return;
    }

    // 3. Upper night sky: silent wish shooting star
    if (pt.y >= 20 && pt.y <= 345 && pt.x >= 180 && pt.x <= 1480) {
      if (window.LetGoSkyFX && window.LetGoSkyFX.triggerShootingStar) {
        window.LetGoSkyFX.triggerShootingStar();
      }
      spawnSparkle(pt.x, pt.y, 5);
    }
  });

  // Gentle curious firefly notices soft mouse movement near the grass & trees
  window.addEventListener('pointermove', (e) => {
    if (reducedMotion) return;
    if (document.body.getAttribute('data-state') !== 'campsite') return;
    const pt = clientToStage(e.clientX, e.clientY);
    if (!pt) return;
    if (pt.y > 420 && pt.y < 860) {
      cursorFly.tx = pt.x + 14;
      cursorFly.ty = pt.y - 16;
      cursorFly.activeUntil = elapsed + 3.2;
    }
  }, { passive: true });

  // Draw tiny shy pixel-art woodland owl perched in the upper-left tree leaves
  function drawOwl(dt) {
    if (!owl.active) return;
    owl.age += dt;
    if (owl.age >= owl.duration) {
      owl.active = false;
      owl.nextVisitAt = elapsed + 48 + Math.random() * 45;
      return;
    }
    owl.blinkTimer -= dt;
    if (owl.blinkTimer <= 0) {
      owl.blinking = !owl.blinking;
      owl.blinkTimer = owl.blinking ? 0.24 : (2.6 + Math.random() * 3.2);
    }

    const fadeIn = Math.min(1, owl.age / 2.2);
    const fadeOut = Math.min(1, (owl.duration - owl.age) / 2.4);
    const a = Math.min(fadeIn, fadeOut) * 0.86;
    const ox = snap(owl.x);
    const oy = snap(owl.y);

    ctx.save();
    ctx.globalAlpha = a;
    // Soft dark-indigo owl silhouette with tiny ear tufts (matches tree shadows)
    ctx.fillStyle = '#1d1c30';
    ctx.fillRect(ox - 12, oy - 12, 24, 28);
    ctx.fillRect(ox - 16, oy - 4, 32, 16);
    ctx.fillRect(ox - 12, oy - 16, 4, 4); // left ear tuft
    ctx.fillRect(ox + 8, oy - 16, 4, 4);  // right ear tuft
    // Subtle lighter belly feathers
    ctx.fillStyle = '#332f4a';
    ctx.fillRect(ox - 8, oy + 4, 16, 12);
    // Tiny warm pale-gold eyes (blink peacefully)
    if (!owl.blinking) {
      ctx.fillStyle = '#ffe1a6';
      ctx.fillRect(ox - 8, oy - 6, 4, 4);
      ctx.fillRect(ox + 4, oy - 6, 4, 4);
    }
    ctx.restore();
  }

  let rafId = null;
  let lastTs = null;
  let elapsed = 0;

  function tick(ts) {
    if (document.hidden) { rafId = null; lastTs = null; return; }
    if (lastTs === null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    elapsed += dt;

    ctx.clearRect(0, 0, W, H);
    const inCampsite = document.body.getAttribute('data-state') === 'campsite';

    // Autonomous shy owl & distant lake trout ripples (only when peacefully in campsite)
    if (inCampsite) {
      if (!owl.active && elapsed >= owl.nextVisitAt) {
        owl.active = true;
        owl.age = 0;
        owl.duration = 18 + Math.random() * 10;
      }
      if (elapsed >= nextLakeFishAt) {
        nextLakeFishAt = elapsed + 16 + Math.random() * 18;
        spawnRipple(380 + Math.random() * 340, 558 + Math.random() * 76, 30 + Math.random() * 14);
      }
    }

    drawOwl(dt);

    // Draw expanding moonlit pixel water ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.age += dt;
      if (r.age >= r.duration) {
        ripples.splice(i, 1);
        continue;
      }
      const p = r.age / r.duration;
      const radX = 4 + p * r.maxR;
      const radY = Math.max(2, radX * 0.24);
      const a = Math.sin(p * Math.PI) * 0.42;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#e8d7c3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(snap(r.x), snap(r.y), Math.round(radX), Math.round(radY), 0, 0, Math.PI * 2);
      ctx.stroke();
      if (p > 0.22) {
        ctx.globalAlpha = a * 0.55;
        ctx.beginPath();
        ctx.ellipse(snap(r.x), snap(r.y), Math.round(radX * 0.62), Math.round(radY * 0.62), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw stoked campfire embers & marshmallow sparkles
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        sparks.splice(i, 1);
        continue;
      }
      s.y += s.vy * dt;
      s.x += (s.vx + Math.sin(s.life * 4.5 + s.wobble) * 18) * dt;
      const p = s.life / s.maxLife;
      const a = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85);
      ctx.globalAlpha = a * 0.92;
      ctx.fillStyle = s.warm
        ? (p < 0.35 ? '#fff1a8' : (p < 0.7 ? '#ff9d36' : '#c9411a'))
        : '#fff3c4';
      ctx.fillRect(snap(s.x), snap(s.y), PIX, PIX);
    }
    ctx.globalAlpha = 1;

    // Gentle curious firefly near pointer
    const wantFly = inCampsite && elapsed < cursorFly.activeUntil;
    cursorFly.alpha += ((wantFly ? 0.82 : 0) - cursorFly.alpha) * Math.min(1, dt * 2.2);
    if (cursorFly.alpha > 0.03) {
      cursorFly.x += (cursorFly.tx - cursorFly.x) * Math.min(1, dt * 1.8);
      cursorFly.y += (cursorFly.ty - cursorFly.y) * Math.min(1, dt * 1.8);
      const fx = snap(cursorFly.x + Math.sin(elapsed * 2.5) * 6);
      const fy = snap(cursorFly.y + Math.cos(elapsed * 2.1) * 5);

      const halo = ctx.createRadialGradient(fx + 2, fy + 2, 1, fx + 2, fy + 2, 20);
      halo.addColorStop(0, `rgba(255, 224, 130, ${(cursorFly.alpha * 0.32).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(255, 180, 70, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(fx - 18, fy - 18, 40, 40);

      ctx.globalAlpha = cursorFly.alpha;
      ctx.fillStyle = '#fff6c2';
      ctx.fillRect(fx, fy, PIX, PIX);
      ctx.globalAlpha = 1;
    }

    rafId = window.requestAnimationFrame(tick);
  }

  window.LetGoDiscoveries = {
    sparkleAt: spawnSparkle,
    stokeFire: () => spawnEmberBurst(822, 690, 16)
  };

  if (!reducedMotion) {
    rafId = window.requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
      lastTs = null;
    } else if (!reducedMotion && !rafId) {
      rafId = window.requestAnimationFrame(tick);
    }
  });
})();
