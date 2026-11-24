/**
 * Project Let Go — The Clearing
 * Phase 6: Complete Ritual & Campsite Flow Controller
 *
 * States: writing -> preview -> burning -> journey -> final -> campsite
 * Also allows entering the campsite directly without writing a letter.
 *
 * PRIVACY GUARANTEE:
 *  - Words exist ONLY in memory while writing/reviewing.
 *  - Zero localStorage, sessionStorage, cookies, or network requests.
 *  - Immediately wiped the moment the burn finishes.
 */

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  const views = {
    writing: $('view-writing'),
    preview: $('view-preview'),
    final: $('view-final')
  };

  const textarea = $('letter');
  const gentleNote = $('gentle-note');
  const reviewBody = $('review-body');
  const btnToPreview = $('btn-to-preview');
  const btnDirectClearing = $('btn-direct-clearing');
  const btnBackWrite = $('btn-back-write');
  const btnLetGo = $('btn-let-go');
  const btnEnterClearing = $('btn-enter-clearing');
  const btnWriteAgain = $('btn-write-again');
  const btnSkip = $('btn-skip');
  const btnOpenWrite = $('btn-open-write');
  const ritualStatus = $('ritual-status');

  let letterText = '';
  let state = 'writing';
  let burnCtrl = null;
  let settleTimer = 0;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function say(msg) {
    if (ritualStatus) ritualStatus.textContent = msg;
  }

  function setSoundPhase(p) {
    if (window.LetGoAudio && window.LetGoAudio.setPhase) {
      window.LetGoAudio.setPhase(p);
    }
  }

  function setState(next) {
    state = next;
    document.body.setAttribute('data-state', next);
    Object.keys(views).forEach((k) => {
      const active = k === next;
      views[k].classList.toggle('is-active', active);
      if (active) views[k].removeAttribute('inert');
      else views[k].setAttribute('inert', '');
    });
  }

  function clearLetter() {
    letterText = '';
    textarea.value = '';
    reviewBody.textContent = '';
    gentleNote.textContent = '';
  }

  // Step 1 -> Step 2: Review what you wrote
  function goToPreview() {
    const val = textarea.value;
    if (!val.trim()) {
      gentleNote.textContent = "Write whatever you'd like to put down, or simply step into the clearing whenever you're ready.";
      textarea.focus();
      return;
    }
    gentleNote.textContent = '';
    letterText = val;
    reviewBody.textContent = letterText;
    setState('preview');
    setTimeout(() => { try { $('preview-heading').focus({ preventScroll: true }); } catch (e) {} }, 180);
  }

  // Step 2 -> Step 1: Keep writing
  function goBackToWrite() {
    setState('writing');
    setTimeout(() => { try { textarea.focus({ preventScroll: true }); } catch (e) {} }, 180);
  }

  // Step 2 -> Step 3: Burn words into the campfire
  function startBurning() {
    if (state !== 'preview') return;
    btnLetGo.disabled = true;
    btnBackWrite.disabled = true;

    const textToBurn = letterText;
    setState('burning');
    setSoundPhase('burning');
    btnSkip.hidden = false;
    say('Your words are drifting into the campfire.');

    const paperEl = $('letter-paper');
    const paperRect = paperEl ? paperEl.getBoundingClientRect() : null;
    const fire = window.LetGoClearing ? window.LetGoClearing.getFireScreenBox() : { cx: window.innerWidth / 2, cy: window.innerHeight * 0.78, pix: 4 };

    if (window.LetGoBurn) {
      burnCtrl = window.LetGoBurn.start({
        text: textToBurn,
        paperRect,
        fire,
        reduced: reducedMotion(),
        onLand: () => {
          if (window.LetGoDiscoveries && window.LetGoDiscoveries.stokeFire) {
            window.LetGoDiscoveries.stokeFire();
          }
          say('Your letter landed in the campfire.');
        },
        onIgnite: () => say('Your letter is burning away into embers.'),
        onDone: onBurnComplete
      });
    } else {
      onBurnComplete();
    }
  }

  // Step 3 -> Step 4: Sky transition + shooting star + comforting message
  function onBurnComplete() {
    burnCtrl = null;
    clearLetter(); // Gone immediately from memory and DOM
    btnLetGo.disabled = false;
    btnBackWrite.disabled = false;
    setState('journey');
    setSoundPhase('journey');
    say('Looking up toward the moon and stars.');

    const reduced = reducedMotion();
    if (window.LetGoClearing) {
      window.LetGoClearing.riseToSky({
        duration: 6800,
        onShootingStar: () => {
          if (window.LetGoSkyFX) window.LetGoSkyFX.triggerShootingStar();
        },
        onDone: () => {
          settleTimer = window.setTimeout(showFinalMessage, reduced ? 250 : 1200);
        }
      });
    } else {
      showFinalMessage();
    }
  }

  function showFinalMessage() {
    clearTimeout(settleTimer);
    btnSkip.hidden = true;
    setState('final');
    setSoundPhase('final');
    setTimeout(() => { try { $('final-heading').focus({ preventScroll: true }); } catch (e) {} }, 180);
  }

  // Step 4 -> Step 5: Smoothly descend into the full-screen campsite
  function enterCampsite() {
    clearTimeout(settleTimer);
    btnSkip.hidden = true;
    setState('campsite');
    setSoundPhase('campsite');
    say('You are sitting beside the campfire.');
    if (window.LetGoClearing) {
      window.LetGoClearing.descendToCampsite({ duration: 3200 });
    }
  }

  // Direct entry from writing screen (no letter needed)
  function enterCampsiteDirectly() {
    clearLetter();
    setState('campsite');
    setSoundPhase('campsite');
    say('You are sitting beside the campfire.');
  }

  // Optional return to writing from either the final sky screen or the subtle corner feather icon
  function openWriting() {
    clearLetter();
    setState('writing');
    setSoundPhase('writing');
    if (window.LetGoClearing) {
      window.LetGoClearing.descendToCampsite({ duration: 1600 });
    }
    setTimeout(() => { try { textarea.focus({ preventScroll: true }); } catch (e) {} }, 220);
  }

  function skipCurrent() {
    if (state === 'burning' && burnCtrl) {
      burnCtrl.skip();
    } else if (state === 'journey' && window.LetGoClearing) {
      window.LetGoClearing.skipSky();
      clearTimeout(settleTimer);
    }
    btnSkip.blur();
  }

  btnToPreview.addEventListener('click', goToPreview);
  btnDirectClearing.addEventListener('click', enterCampsiteDirectly);
  btnBackWrite.addEventListener('click', goBackToWrite);
  btnLetGo.addEventListener('click', startBurning);
  btnEnterClearing.addEventListener('click', enterCampsite);
  btnWriteAgain.addEventListener('click', openWriting);
  btnSkip.addEventListener('click', skipCurrent);
  btnOpenWrite.addEventListener('click', openWriting);

  textarea.addEventListener('input', () => {
    if (gentleNote.textContent) gentleNote.textContent = '';
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) clearLetter();
  });

  clearLetter();
  setState('writing');
})();
