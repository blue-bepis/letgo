/**
 * Project Let Go — The Clearing
 * Phase 4 + Phase 7: Bear Character Animation & Marshmallow-Offering Moment
 *
 * States:
 *  - idle, roasting, looking, eating, happy, sleepy
 *  - offering (Phase 7): looks warmly toward the visitor and gently holds out
 *    a toasted marshmallow; visitor can accept it or simply sit quietly.
 */

(function () {
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const faceCanvas = document.getElementById('fx-bear-face-canvas');
  const hitbox = document.getElementById('bear-hitbox');
  const offerPrompt = document.getElementById('bear-offer-prompt');
  const offerAcceptBtn = document.getElementById('btn-accept-marshmallow');
  const whisperToast = document.getElementById('clearing-whisper');
  if (!faceCanvas) return;

  const ctx = faceCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const COL = {
    dark: '#22121e',
    mouthInner: '#4a1f24',
  };

  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // Seamless pixel-textured fur patch (inpainted directly from 13_bear_body.png)
  const cleanFurImg = new Image();
  let cleanFurReady = false;
  cleanFurImg.onload = () => { cleanFurReady = true; };
  cleanFurImg.src = (window.LET_GO_EMBEDDED_DATA && window.LET_GO_EMBEDDED_DATA.bearCleanFurSrc)
    ? window.LET_GO_EMBEDDED_DATA.bearCleanFurSrc
    : 'assets/bear/13b_bear_eyes_clean_fur.png';

  function drawRoundedPixelEye(x, y, w, h) {
    ctx.fillStyle = 'rgba(34, 18, 30, 0.28)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = COL.dark;
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = '#f2cea2';
    ctx.fillRect(x + 1, y + 1, 2, 2);
  }

  function renderFace(eyeMode, lookDir, mouthMode, blushAlpha) {
    ctx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);

    if (blushAlpha > 0.01) {
      ctx.fillStyle = `rgba(225, 118, 78, ${(blushAlpha * 0.22).toFixed(3)})`;
      ctx.fillRect(142, 108, 18, 8);
      ctx.fillRect(99, 106, 10, 6);
    }

    if ((eyeMode === 'open' || eyeMode === 'half' || eyeMode === 'happy') && cleanFurReady) {
      ctx.drawImage(cleanFurImg, 92, 70);

      let gx = 0;
      let gy = 0;
      if (lookDir === 'sky') { gx = -1; gy = -2; }
      else if (lookDir === 'lake') { gx = -2; gy = 0; }
      else if (lookDir === 'viewer') { gx = 1; gy = 1; }
      else { gx = -1; gy = 1; }

      if (eyeMode === 'open') {
        drawRoundedPixelEye(156 + gx, 85 + gy, 10, 10);
        drawRoundedPixelEye(106 + Math.round(gx * 0.5), 83 + gy, 7, 8);
      } else if (eyeMode === 'half') {
        ctx.fillStyle = 'rgba(34, 18, 30, 0.26)';
        ctx.fillRect(154 + gx, 87, 14, 7);
        px(155 + gx, 89, 12, 4, COL.dark);
        px(106, 86, 8, 4, COL.dark);
      } else if (eyeMode === 'happy') {
        px(154, 89, 3, 3, COL.dark);
        px(157, 86, 7, 3, COL.dark);
        px(164, 89, 3, 3, COL.dark);
        px(105, 87, 3, 3, COL.dark);
        px(108, 84, 4, 3, COL.dark);
        px(112, 87, 3, 3, COL.dark);
      }
    }

    if (mouthMode === 'chew_open') {
      px(111, 128, 10, 5, COL.mouthInner);
      px(112, 132, 8, 2, COL.dark);
    } else if (mouthMode === 'chew_mid') {
      px(113, 129, 6, 2, 'rgba(34, 18, 30, 0.45)');
    }
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  let bearEl = null;
  let stickRigEl = null;
  let marshEl = null;
  let noteEl = null;

  let state = 'idle';
  let stateTime = 0;
  let stateDuration = 8.5;
  let lookTarget = 'fire';

  let blinkTimer = 3.2;
  const blinkDuration = 0.22;
  let isBlinking = false;
  let eyesOpenInIdle = false;
  let idleEyeToggleTimer = 4.5;

  let marshVisible = true;
  let marshToasted = 0;
  let offerPending = false;
  let interactionCount = 0;
  let campsiteSeconds = 0;
  let nextAutonomousOfferAt = 24; // Offers a marshmallow gently after ~24s in the clearing
  let whisperTimer = 0;

  function showWhisper(text, ms) {
    if (!whisperToast) return;
    clearTimeout(whisperTimer);
    whisperToast.textContent = text;
    whisperToast.classList.add('is-visible');
    whisperTimer = window.setTimeout(() => {
      whisperToast.classList.remove('is-visible');
    }, ms || 3400);
  }

  function setOfferPromptVisible(show) {
    if (!offerPrompt) return;
    const inCampsite = document.body.getAttribute('data-state') === 'campsite';
    const visible = show && inCampsite;
    offerPrompt.classList.toggle('is-visible', visible);
    if (visible) offerPrompt.removeAttribute('inert');
    else offerPrompt.setAttribute('inert', '');
  }

  function enterState(next, duration) {
    state = next;
    stateTime = 0;
    stateDuration = duration;
    if (next !== 'eating' && next !== 'accepted') {
      marshVisible = true;
    }
    setOfferPromptVisible(next === 'offering');
  }

  function chooseNextState() {
    if (offerPending) {
      offerPending = false;
      enterState('eating', 7.2);
      return;
    }

    const inCampsite = document.body.getAttribute('data-state') === 'campsite';
    if (inCampsite && campsiteSeconds >= nextAutonomousOfferAt) {
      nextAutonomousOfferAt = campsiteSeconds + 55 + Math.random() * 40;
      marshToasted = 0.72;
      enterState('offering', 14.0);
      return;
    }

    const r = Math.random();
    if (r < 0.36) {
      enterState('idle', 7.5 + Math.random() * 5.5);
    } else if (r < 0.64) {
      enterState('roasting', 8.0 + Math.random() * 5.0);
    } else if (r < 0.78) {
      const dirs = ['lake', 'sky', 'viewer', 'fire'];
      lookTarget = dirs[Math.floor(Math.random() * dirs.length)];
      enterState('looking', 4.5 + Math.random() * 3.0);
    } else if (r < 0.88) {
      enterState('sleepy', 6.5 + Math.random() * 4.0);
    } else if (r < 0.95) {
      enterState('eating', 7.2);
    } else {
      enterState('happy', 4.5 + Math.random() * 2.5);
    }
  }

  function acceptMarshmallow() {
    if (state !== 'offering') return;
    setOfferPromptVisible(false);
    enterState('accepted', 4.6);
    if (window.LetGoDiscoveries && window.LetGoDiscoveries.sparkleAt) {
      window.LetGoDiscoveries.sparkleAt(925, 585, 10);
    }
    const notes = [
      'Warm and slightly toasted.',
      'Sweet, warm, and quiet.',
      'Soft and warm from the fire.'
    ];
    showWhisper(notes[Math.floor(Math.random() * notes.length)], 3600);
  }

  // Click/tap directly on the bear or marshmallow
  function handleBearInteract() {
    if (reducedMotion) return;
    if (document.body.getAttribute('data-state') !== 'campsite') return;
    if (state === 'offering') {
      acceptMarshmallow();
      return;
    }
    if (state === 'eating' || state === 'accepted') return;

    interactionCount++;
    // Every 2nd click, he sweetly offers YOU a toasted marshmallow in return!
    if (interactionCount % 2 === 0) {
      marshVisible = true;
      marshToasted = 0.78;
      enterState('offering', 14.0);
    } else {
      marshVisible = true;
      marshToasted = 0.25;
      offerPending = true;
      enterState('happy', 1.7);
    }
  }

  if (hitbox) hitbox.addEventListener('click', handleBearInteract);
  if (offerAcceptBtn) offerAcceptBtn.addEventListener('click', acceptMarshmallow);

  let rafId = null;
  let lastTs = null;
  let totalTime = 0;

  function update(dt) {
    totalTime += dt;
    stateTime += dt;
    const inCampsite = document.body.getAttribute('data-state') === 'campsite';
    if (inCampsite) {
      campsiteSeconds += dt;
    } else if (state === 'offering') {
      setOfferPromptVisible(false);
    }

    if (stateTime >= stateDuration) {
      if (state === 'eating') {
        enterState('happy', 3.6);
      } else if (state === 'offering') {
        // Gently pulls it back with zero guilt and eats it himself
        setOfferPromptVisible(false);
        enterState('eating', 7.2);
      } else if (state === 'accepted') {
        enterState('idle', 8.0);
      } else {
        chooseNextState();
      }
    }

    const breathWave = Math.sin(totalTime * ((Math.PI * 2) / 5.6));
    let bodyScaleY = 1 + breathWave * 0.009;
    let bodyScaleX = 1 - breathWave * 0.004;
    let bodyY = -breathWave * 1.4;
    let bodyRot = Math.sin(totalTime * 0.42) * 0.35;

    let stickRot = breathWave * 1.1;
    let stickTx = 0;
    let stickTy = bodyY;
    let marshScale = 1;
    let marshSpin = 0;
    let marshOpacity = marshVisible ? 1 : 0;
    let marshExtraTx = 0;
    let marshExtraTy = 0;
    let marshGlow = false;

    let eyeMode = 'closed';
    let lookDir = 'fire';
    let mouthMode = 'default';
    let blushAlpha = 0;
    let showNote = false;

    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      isBlinking = !isBlinking;
      blinkTimer = isBlinking ? blinkDuration : (3.4 + Math.random() * 4.2);
    }

    idleEyeToggleTimer -= dt;
    if (idleEyeToggleTimer <= 0) {
      eyesOpenInIdle = !eyesOpenInIdle;
      idleEyeToggleTimer = eyesOpenInIdle ? (3.5 + Math.random() * 3.5) : (5.0 + Math.random() * 5.0);
    }

    if (state === 'idle') {
      eyeMode = (eyesOpenInIdle && !isBlinking) ? 'open' : 'closed';
      lookDir = 'fire';
      stickRot += Math.sin(totalTime * 0.7) * 0.8;
    } else if (state === 'roasting') {
      eyeMode = isBlinking ? 'closed' : 'open';
      lookDir = 'fire';
      stickRot += Math.sin(stateTime * 1.1) * 2.2 - 1.2;
      marshSpin = Math.sin(stateTime * 1.8) * 14;
      marshToasted = Math.min(1, marshToasted + dt * 0.06);
    } else if (state === 'looking') {
      const p = stateTime / stateDuration;
      const hold = p < 0.18 ? easeInOut(p / 0.18) : (p > 0.82 ? easeInOut((1 - p) / 0.18) : 1);
      eyeMode = isBlinking ? 'closed' : 'open';
      lookDir = lookTarget;
      if (lookTarget === 'sky') { bodyRot += hold * 1.1; bodyY -= hold * 2.0; }
      else if (lookTarget === 'viewer') { bodyRot -= hold * 0.6; }
      else { bodyRot -= hold * 0.8; }
    } else if (state === 'sleepy') {
      const p = stateTime / stateDuration;
      const droop = p < 0.25
        ? easeInOut(p / 0.25)
        : (p < 0.78 ? 1 + Math.sin((p - 0.25) * 12) * 0.08 : easeInOut((1 - p) / 0.22));
      bodyY += droop * 4.2;
      bodyRot -= droop * 1.6;
      stickRot -= droop * 2.6;
      eyeMode = (p < 0.22 || p > 0.84) ? 'half' : 'closed';
    } else if (state === 'happy') {
      const p = stateTime / stateDuration;
      const lift = Math.sin(p * Math.PI);
      eyeMode = 'happy';
      blushAlpha = lift;
      bodyY -= lift * 2.5 + Math.sin(stateTime * 3.2) * 1.1;
      bodyRot += Math.sin(stateTime * 2.1) * 0.85;
      showNote = true;
    } else if (state === 'offering') {
      // Gently leans slightly forward, looks warmly at the visitor; stick stays locked in paws!
      const inEase = easeInOut(Math.min(1, stateTime / 1.3));
      const gentleBob = Math.sin(stateTime * 2.0) * 1.2;
      bodyRot -= inEase * 1.2;
      bodyY -= inEase * 1.4;
      stickRot = -inEase * 11 + gentleBob * 0.7;
      stickTx = 0;
      stickTy = bodyY;
      eyeMode = isBlinking ? 'closed' : 'open';
      lookDir = 'viewer';
      blushAlpha = inEase * 0.55;
      marshGlow = true;
    } else if (state === 'accepted') {
      // Marshmallow drifts smoothly toward the visitor & fades; bear beams happily!
      if (stateTime < 1.3) {
        const u = easeInOut(stateTime / 1.3);
        stickRot = -11 * (1 - u);
        stickTx = 0;
        stickTy = bodyY;
        marshExtraTx = -u * 75;
        marshExtraTy = u * 165;
        marshScale = 1 + u * 0.18;
        marshOpacity = Math.max(0, 1 - u * 1.15);
      } else if (stateTime < 3.2) {
        marshOpacity = 0;
      } else {
        const u = easeInOut((stateTime - 3.2) / 1.4);
        marshVisible = true;
        marshOpacity = u;
        marshScale = 0.65 + 0.35 * u;
        marshToasted = 0;
      }
      eyeMode = 'happy';
      blushAlpha = Math.sin(Math.min(1, stateTime / 3.8) * Math.PI);
      bodyY -= Math.sin(stateTime * 3.0) * 1.3 + 1.5;
      bodyRot += Math.sin(stateTime * 2.0) * 0.8;
      showNote = stateTime < 3.6;
    } else if (state === 'eating') {
      if (stateTime < 1.6) {
        const u = easeInOut(stateTime / 1.6);
        stickRot = u * 31;
        stickTx = u * 3;
        stickTy = bodyY - u * 3;
        eyeMode = 'open';
        lookDir = 'fire';
        bodyY -= u * 1.5;
      } else if (stateTime < 2.2) {
        const u = (stateTime - 1.6) / 0.6;
        stickRot = 31;
        stickTx = 3;
        stickTy = bodyY - 3;
        marshScale = Math.max(0, 1 - u);
        marshOpacity = Math.max(0, 1 - u);
        mouthMode = u < 0.5 ? 'chew_open' : 'chew_mid';
        eyeMode = 'happy';
        blushAlpha = 0.7;
      } else if (stateTime < 5.2) {
        const u = easeInOut(Math.min(1, (stateTime - 2.2) / 1.2));
        stickRot = 31 * (1 - u);
        stickTx = 3 * (1 - u);
        stickTy = bodyY - 3 * (1 - u);
        marshOpacity = 0;
        const chewPhase = (stateTime - 2.2) * 5.2;
        mouthMode = Math.sin(chewPhase) > 0.15 ? 'chew_open' : 'chew_mid';
        eyeMode = 'happy';
        blushAlpha = 0.9;
        bodyY -= Math.abs(Math.sin(chewPhase * 0.5)) * 1.4;
        showNote = true;
      } else {
        const u = easeInOut((stateTime - 5.2) / 2.0);
        marshVisible = true;
        marshOpacity = u;
        marshScale = 0.6 + 0.4 * u;
        marshToasted = 0;
        eyeMode = 'happy';
        blushAlpha = 1 - u;
        showNote = u < 0.7;
      }
    }

    const bearTransform = `translate3d(0, ${bodyY.toFixed(2)}px, 0) rotate(${bodyRot.toFixed(2)}deg) scale(${bodyScaleX.toFixed(4)}, ${bodyScaleY.toFixed(4)})`;
    if (bearEl) bearEl.style.transform = bearTransform;
    faceCanvas.style.transform = bearTransform;

    if (stickRigEl) {
      stickRigEl.style.transform = `translate3d(${stickTx.toFixed(2)}px, ${stickTy.toFixed(2)}px, 0) rotate(${stickRot.toFixed(2)}deg)`;
    }

    if (marshEl) {
      const twistScaleY = 1 + Math.sin(marshSpin * 0.12) * 0.045;
      marshEl.style.opacity = marshOpacity.toFixed(3);
      marshEl.style.transform = `translate3d(${marshExtraTx.toFixed(1)}px, ${marshExtraTy.toFixed(1)}px, 0) scale(${marshScale.toFixed(3)}, ${(marshScale * twistScaleY).toFixed(3)})`;
      const glowFilter = marshGlow
        ? ` drop-shadow(0 0 ${(6 + Math.sin(totalTime * 4) * 3).toFixed(1)}px rgba(255, 214, 130, 0.85))`
        : '';
      marshEl.style.filter = (marshToasted > 0.05
        ? `sepia(${(marshToasted * 0.28).toFixed(2)}) brightness(${(1 - marshToasted * 0.06).toFixed(2)})`
        : '') + glowFilter;
    }

    if (noteEl) {
      if (showNote) {
        noteEl.style.opacity = '0.92';
        const noteBob = Math.sin(totalTime * 2.4) * 5;
        const noteSway = Math.cos(totalTime * 1.6) * 3;
        noteEl.style.transform = `translate3d(${noteSway.toFixed(2)}px, ${noteBob.toFixed(2)}px, 0)`;
      } else {
        noteEl.style.opacity = '0';
      }
    }

    renderFace(eyeMode, lookDir, mouthMode, blushAlpha);
  }

  function tick(ts) {
    if (document.hidden) { rafId = null; lastTs = null; return; }
    if (lastTs === null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    rafId = window.requestAnimationFrame(tick);
  }

  function start() {
    bearEl = document.getElementById('layer-bear_body');
    stickRigEl = document.getElementById('stick-rig');
    marshEl = document.getElementById('layer-marshmallow');
    noteEl = document.getElementById('layer-music_note');
    if (!bearEl) return;

    if (reducedMotion) {
      if (noteEl) noteEl.style.opacity = '0.85';
      return;
    }
    if (!rafId) {
      lastTs = null;
      rafId = window.requestAnimationFrame(tick);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
      lastTs = null;
    } else if (!reducedMotion && !rafId && bearEl) {
      rafId = window.requestAnimationFrame(tick);
    }
  });

  window.addEventListener('letgo:layers-ready', start);
  if (document.getElementById('layer-bear_body')) start();
})();
