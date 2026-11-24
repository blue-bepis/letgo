/**
 * Project Let Go — The Clearing
 * Phase 6: Scene Mounting, Responsive Framing & Cinematic Sky Journey
 *
 * Keeps all 19 pixel-art layers embedded cleanly (no fetch calls needed, so
 * the strict privacy guard stays 100% intact and GitHub Pages works anywhere).
 */

(function () {
  const SCENE_W = 1672;
  const SCENE_H = 941;
  const SCENE_RATIO = SCENE_W / SCENE_H;

  const MANIFEST_ASSETS = [
  {
    "id": "sky_base",
    "name": "Night Sky & Clouds (Clean Plate)",
    "file": "assets/sky/01_sky_base.png",
    "zIndex": 1,
    "x": 0,
    "y": 0,
    "width": 1672,
    "height": 532
  },
  {
    "id": "moon",
    "name": "Full Moon",
    "file": "assets/sky/02_moon.png",
    "zIndex": 2,
    "x": 561,
    "y": 75,
    "width": 181,
    "height": 183
  },
  {
    "id": "mountains_forest",
    "name": "Distant Mountains & Far Forest",
    "file": "assets/environment/03_mountains_forest.png",
    "zIndex": 3,
    "x": 0,
    "y": 196,
    "width": 1672,
    "height": 332
  },
  {
    "id": "lake_base",
    "name": "Lake Surface & Reflections",
    "file": "assets/environment/04_lake_base.png",
    "zIndex": 4,
    "x": 0,
    "y": 520,
    "width": 1672,
    "height": 187
  },
  {
    "id": "left_tree",
    "name": "Left Foreground Tree & Canopy",
    "file": "assets/environment/05_left_foreground_tree.png",
    "zIndex": 5,
    "x": 0,
    "y": 0,
    "width": 428,
    "height": 613
  },
  {
    "id": "right_tree",
    "name": "Right Foreground Tree & Canopy",
    "file": "assets/environment/06_right_foreground_tree.png",
    "zIndex": 6,
    "x": 1208,
    "y": 0,
    "width": 464,
    "height": 578
  },
  {
    "id": "ground_clearing",
    "name": "Ground Clearing, Grass & Wildflowers",
    "file": "assets/environment/07_ground_clearing.png",
    "zIndex": 7,
    "x": 0,
    "y": 560,
    "width": 1672,
    "height": 381
  },
  {
    "id": "hanging_lantern_post",
    "name": "Wooden Lantern Post",
    "file": "assets/props/08_hanging_lantern_post.png",
    "zIndex": 8,
    "x": 46,
    "y": 322,
    "width": 191,
    "height": 306
  },
  {
    "id": "hanging_lantern",
    "name": "Hanging Lantern",
    "file": "assets/props/09_hanging_lantern.png",
    "zIndex": 9,
    "x": 148,
    "y": 381,
    "width": 79,
    "height": 125
  },
  {
    "id": "standing_lantern",
    "name": "Standing Ground Lantern",
    "file": "assets/props/10_standing_lantern.png",
    "zIndex": 10,
    "x": 175,
    "y": 644,
    "width": 110,
    "height": 197
  },
  {
    "id": "campfire_base",
    "name": "Campfire Stones & Logs",
    "file": "assets/campfire/11_campfire_stones_and_wood.png",
    "zIndex": 11,
    "x": 592,
    "y": 719,
    "width": 448,
    "height": 139
  },
  {
    "id": "campfire_flames",
    "name": "Campfire Flames (Reference)",
    "file": "assets/campfire/12_campfire_flames.png",
    "zIndex": 12,
    "x": 700,
    "y": 463,
    "width": 244,
    "height": 311
  },
  {
    "id": "bear_body",
    "name": "Brown Bear (Idle Base)",
    "file": "assets/bear/13_bear_body.png",
    "zIndex": 13,
    "x": 1031,
    "y": 349,
    "width": 398,
    "height": 419
  },
  {
    "id": "marshmallow_stick",
    "name": "Wooden Roasting Stick",
    "file": "assets/bear/14_marshmallow_stick.png",
    "zIndex": 14,
    "x": 935,
    "y": 504,
    "width": 173,
    "height": 97
  },
  {
    "id": "marshmallow",
    "name": "Marshmallow",
    "file": "assets/bear/15_marshmallow.png",
    "zIndex": 15,
    "x": 954,
    "y": 504,
    "width": 57,
    "height": 55
  },
  {
    "id": "camping_mug",
    "name": "Pine-Tree Camping Mug",
    "file": "assets/props/16_camping_mug.png",
    "zIndex": 16,
    "x": 1300,
    "y": 723,
    "width": 95,
    "height": 89
  },
  {
    "id": "backpack",
    "name": "Camping Backpack",
    "file": "assets/props/17_backpack.png",
    "zIndex": 17,
    "x": 1408,
    "y": 621,
    "width": 243,
    "height": 217
  },
  {
    "id": "mina_knees",
    "name": "Mina's Hoodie-Covered Knees",
    "file": "assets/foreground/18_mina_knees.png",
    "zIndex": 18,
    "x": 250,
    "y": 768,
    "width": 1139,
    "height": 173
  },
  {
    "id": "music_note",
    "name": "Floating Music Note",
    "file": "assets/bear/19_music_note.png",
    "zIndex": 19,
    "x": 1292,
    "y": 315,
    "width": 34,
    "height": 45
  }
];

  const stage = document.getElementById('scene-stage');
  const layerRoot = document.getElementById('scene-layers');
  const refOverlay = document.getElementById('ref-compare-overlay');

  let baseScale = 1;
  let baseOffsetX = 0;
  let baseOffsetY = 0;
  let skyProgress = 0; // 0 = campsite POV, 1 = gazing up at the full moon & stars
  let skyRaf = 0;
  let skyTween = null;

  function smootherstep(u) {
    return u * u * u * (u * (u * 6 - 15) + 10);
  }

  function applyStageTransform() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const viewRatio = vw / vh;

    baseScale = Math.max(vw / SCENE_W, vh / SCENE_H);
    const scaledW = SCENE_W * baseScale;
    const scaledH = SCENE_H * baseScale;

    // Smart focal shift on narrow/portrait screens so moon, fire, marshmallow & bear stay framed
    let focalX = 0.5;
    if (viewRatio < SCENE_RATIO) {
      const narrowness = Math.min(1, (SCENE_RATIO - viewRatio) / (SCENE_RATIO - 0.52));
      focalX = 0.5 + narrowness * 0.085;
    }
    let focalY = 0.5;
    if (viewRatio > SCENE_RATIO) {
      const wideness = Math.min(1, (viewRatio - SCENE_RATIO) / 1.0);
      focalY = 0.5 + wideness * 0.04;
    }

    baseOffsetX = -(scaledW - vw) * focalX;
    baseOffsetY = -(scaledH - vh) * focalY;

    if (skyProgress <= 0.0001) {
      stage.style.transform = `translate3d(${baseOffsetX.toFixed(2)}px, ${baseOffsetY.toFixed(2)}px, 0) scale(${baseScale.toFixed(5)})`;
      return;
    }

    // Smooth cinematic zoom/glide focusing up on our full moon (651, 165) & night sky!
    const f = skyProgress;
    const targetScale = baseScale * (1 + 0.62 * f);
    // Aim moon cleanly into upper-center of viewport so comforting message sits calmly beneath it
    const moonTargetScreenX = vw * 0.5;
    const moonTargetScreenY = vh * 0.28;
    const skyOffsetX = moonTargetScreenX - 651 * targetScale;
    const skyOffsetY = moonTargetScreenY - 165 * targetScale;

    // Clamp so we never expose blank edges outside the 1672x941 sky plate
    const minX = vw - SCENE_W * targetScale;
    const minY = vh - SCENE_H * targetScale;
    const clampedSkyX = Math.min(0, Math.max(minX, skyOffsetX));
    const clampedSkyY = Math.min(0, Math.max(minY, skyOffsetY));

    const curX = baseOffsetX + (clampedSkyX - baseOffsetX) * f;
    const curY = baseOffsetY + (clampedSkyY - baseOffsetY) * f;
    stage.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0) scale(${targetScale.toFixed(5)})`;
  }

  // Pixel-exact screen-space coordinates of the glowing campfire hearth (822, 735)
  function getFireScreenBox() {
    const rect = stage.getBoundingClientRect();
    const s = rect.width ? (rect.width / SCENE_W) : baseScale;
    const ox = rect.width ? rect.left : baseOffsetX;
    const oy = rect.height ? rect.top : baseOffsetY;
    return {
      cx: ox + 822 * s,
      cy: oy + 735 * s,
      w: 180 * s,
      h: 160 * s,
      pix: Math.max(3, Math.round(4 * s))
    };
  }

  function animateSkyTo(target, durationMs, onShootingStar, onDone) {
    if (skyRaf) cancelAnimationFrame(skyRaf);
    const startVal = skyProgress;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || durationMs <= 0) {
      skyProgress = target;
      applyStageTransform();
      if (onDone) onDone();
      return;
    }

    let shotFired = false;
    skyTween = { startVal, target, duration: durationMs, startTime: null, quick: false, onShootingStar, onDone };

    function step(now) {
      if (!skyTween) return;
      if (skyTween.startTime === null) skyTween.startTime = now;
      const v = Math.min(1, (now - skyTween.startTime) / skyTween.duration);
      const eased = skyTween.quick ? (1 - (1 - v) * (1 - v)) : smootherstep(v);
      skyProgress = skyTween.startVal + (skyTween.target - skyTween.startVal) * eased;
      applyStageTransform();

      if (!shotFired && skyTween.target > 0.5 && v >= 0.62) {
        shotFired = true;
        if (skyTween.onShootingStar) skyTween.onShootingStar();
      }

      if (v < 1) {
        skyRaf = requestAnimationFrame(step);
      } else {
        const done = skyTween.onDone;
        skyTween = null;
        if (done) done();
      }
    }
    skyRaf = requestAnimationFrame(step);
  }

  function skipSky() {
    if (!skyTween || skyTween.quick) return;
    skyTween.quick = true;
    skyTween.startVal = skyProgress;
    skyTween.startTime = null;
    skyTween.duration = 900;
  }

  function mountLayers() {
    const assets = (window.LET_GO_EMBEDDED_DATA && window.LET_GO_EMBEDDED_DATA.assets)
      ? window.LET_GO_EMBEDDED_DATA.assets
      : MANIFEST_ASSETS;

    layerRoot.innerHTML = '';
    const stickRig = document.createElement('div');
    stickRig.id = 'stick-rig';
    layerRoot.appendChild(stickRig);

    assets.forEach((asset) => {
      const img = document.createElement('img');
      img.id = `layer-${asset.id}`;
      img.className = 'scene-layer';
      img.src = asset.src || asset.file;
      img.alt = asset.name;
      img.decoding = 'async';
      img.draggable = false;
      img.style.left = `${asset.x}px`;
      img.style.top = `${asset.y}px`;
      img.style.width = `${asset.width}px`;
      img.style.height = `${asset.height}px`;
      img.style.zIndex = String(asset.zIndex);
      if (asset.id === 'marshmallow_stick' || asset.id === 'marshmallow') {
        stickRig.appendChild(img);
      } else {
        layerRoot.appendChild(img);
      }
    });

    const paperBg = document.getElementById('letter-paper-bg');
    if (paperBg && window.LET_GO_EMBEDDED_DATA && window.LET_GO_EMBEDDED_DATA.parchmentSrc) {
      paperBg.src = window.LET_GO_EMBEDDED_DATA.parchmentSrc;
    }
    if (refOverlay && window.LET_GO_EMBEDDED_DATA && window.LET_GO_EMBEDDED_DATA.referenceSrc) {
      refOverlay.src = window.LET_GO_EMBEDDED_DATA.referenceSrc;
    }

    window.dispatchEvent(new CustomEvent('letgo:layers-ready'));
  }

  // Keyboard-only developer reference toggle (only active when sitting in campsite)
  window.addEventListener('keydown', (e) => {
    if (document.body.getAttribute('data-state') !== 'campsite') return;
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (refOverlay) refOverlay.classList.toggle('is-visible');
    }
  });

  window.addEventListener('resize', applyStageTransform, { passive: true });
  window.addEventListener('orientationchange', applyStageTransform, { passive: true });

  window.LetGoClearing = {
    getFireScreenBox,
    riseToSky: (opts) => animateSkyTo(1, (opts && opts.duration) || 6800, opts && opts.onShootingStar, opts && opts.onDone),
    descendToCampsite: (opts) => animateSkyTo(0, (opts && opts.duration) || 3400, null, opts && opts.onDone),
    skipSky,
    resetInstant: () => { skyProgress = 0; applyStageTransform(); }
  };

  function init() {
    applyStageTransform();
    mountLayers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
