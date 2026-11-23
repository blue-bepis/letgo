/* =====================================================================
   LET GO — app.js
   Controls which "state" the visitor is in and runs the ritual:

     writing -> preview -> burning -> journey (camera rises) -> final -> writing

   PRIVACY RULES THIS FILE FOLLOWS
   - The letter lives only in the text box and in the variable `letterText`
     (and, for a few seconds while it burns, drawn on a canvas by burn.js).
   - It is never saved (no localStorage, sessionStorage, cookies, IndexedDB).
   - It is never sent anywhere (no fetch, XHR, forms, WebSockets).
   - It is never written to the console or put in the address bar.
   - The preview is filled with textContent (never innerHTML), so nothing
     the visitor types can be run as code.
   - clearLetter() wipes everything the moment the paper has burned away.
   ===================================================================== */
(function () {
  'use strict';

  // ---- Grab the pieces of the page we need ----
  function $(id) { return document.getElementById(id); }

  var views = {
    writing: $('view-writing'),
    preview: $('view-preview'),
    final: $('view-final')
  };
  var focusTargets = {
    writing: $('letter'),
    preview: $('letter-sheet'),
    final: $('final-title')
  };

  var textarea = $('letter');
  var gentleMessage = $('gentle-message');
  var letterBody = $('letter-body');
  var btnDone = $('btn-done');
  var btnBack = $('btn-back');
  var btnBurn = $('btn-burn');
  var btnReturn = $('btn-return');
  var btnSkip = $('btn-skip');
  var ritualStatus = $('ritual-status');

  // ---- The only place the letter is ever held (memory only) ----
  var letterText = '';

  // Which part of the ritual we're in:
  // 'writing' | 'preview' | 'burning' | 'journey' | 'final' | 'resetting'
  var phase = 'writing';
  var burnControl = null;      // lets "Skip" speed up the burn
  var settleTimer = 0;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Tell the sound system which part of the ritual we're in (it only changes
  // volumes; it never sees the letter). Safe even if sound isn't available.
  function setSoundPhase(name) {
    if (window.LetGoAudio && window.LetGoAudio.setPhase) { window.LetGoAudio.setPhase(name); }
  }

  // A quiet spoken update for screen-reader users (visually hidden).
  function say(message) { ritualStatus.textContent = message; }

  // ---- Switching between states: fade one view out, the next one in ----
  // Any name that isn't a view ('burning', 'journey', 'resetting') simply
  // hides all the views while the picture does its work.
  function showView(name) {
    Object.keys(views).forEach(function (key) {
      var isActive = key === name;
      views[key].classList.toggle('is-active', isActive);
      if (isActive) {
        views[key].removeAttribute('inert');
      } else {
        views[key].setAttribute('inert', '');   // inactive views can't be tabbed into
      }
    });
    document.body.setAttribute('data-state', name);
  }

  // Move keyboard focus once the new view has started appearing.
  function focusOn(name) {
    window.setTimeout(function () {
      try { focusTargets[name].focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }, 150);
  }

  // ---- Wipe the letter from memory, the text box and the page ----
  function clearLetter() {
    letterText = '';
    textarea.value = '';
    letterBody.textContent = '';
    gentleMessage.textContent = '';
  }

  // ---- Writing -> Preview ----
  function goToPreview() {
    var text = textarea.value;
    if (text.trim() === '') {
      gentleMessage.textContent =
        "There's nothing to burn yet. Write whatever you need to, and take your time.";
      textarea.focus();
      return;
    }
    gentleMessage.textContent = '';
    letterText = text;
    letterBody.textContent = letterText;     // textContent keeps it safe & keeps line breaks (via CSS)
    phase = 'preview';
    showView('preview');
    focusOn('preview');
    $('letter-sheet').scrollTop = 0;
  }

  // ---- Preview -> Writing (the text is still in the box, in memory only) ----
  function goBackToWriting() {
    phase = 'writing';
    showView('writing');
    window.setTimeout(function () {
      textarea.focus();
      var end = textarea.value.length;
      try { textarea.setSelectionRange(end, end); } catch (e) { /* ignore */ }
    }, 150);
  }

  // ---- Preview -> Burning -> Journey -> Final ----
  function burnIt() {
    if (phase !== 'preview') { return; }
    phase = 'burning';
    btnBurn.disabled = true;
    btnBack.disabled = true;

    // Measure the parchment sheet BEFORE anything changes: the paper that flies
    // into the fire starts exactly where this sheet is.
    var panel = views.preview.getBoundingClientRect();
    var bodyStyle = window.getComputedStyle(letterBody);
    var text = letterText;

    var started = false;
    if (window.LetGoBurn && window.LetGoScene) {
      try {
        burnControl = window.LetGoBurn.start({
          text: text,
          panel: { left: panel.left, top: panel.top, width: panel.width, height: panel.height },
          fire: window.LetGoScene.fireBox(),
          fontPx: parseFloat(bodyStyle.fontSize) || 22,
          fontFamily: bodyStyle.fontFamily,
          reduced: reducedMotion(),
          onIgnite: function () { document.body.classList.add('is-burning'); say('The letter has caught fire.'); },
          onDone: paperIsGone
        });
        started = true;
      } catch (e) {
        started = false;            // canvas not available: skip straight to the journey
      }
    }

    views.preview.classList.add('is-throwing');   // the canvas paper takes the sheet's place
    showView('burning');
    setSoundPhase('burning');
    btnSkip.hidden = false;
    btnSkip.focus();
    say('The letter is on its way to the fire.');

    if (!started) { paperIsGone(); }
  }

  // The paper has burned away completely.
  function paperIsGone() {
    burnControl = null;
    clearLetter();                                  // gone from memory, the text box and the page
    views.preview.classList.remove('is-throwing');
    document.body.classList.remove('is-burning');
    phase = 'journey';
    document.body.setAttribute('data-state', 'journey');
    setSoundPhase('sky');
    say('The letter has burned away.');

    var reduced = reducedMotion();
    if (!window.LetGoScene) { showFinal(); return; }
    window.LetGoScene.rise({
      reduced: reduced,
      onShootingStar: window.LetGoScene.shootingStar,
      onDone: function () {
        // let the sky settle for a moment before the words appear
        settleTimer = window.setTimeout(showFinal, reduced ? 300 : 1800);
      }
    });
  }

  function showFinal() {
    clearTimeout(settleTimer);
    phase = 'final';
    btnSkip.hidden = true;
    btnBurn.disabled = false;
    btnBack.disabled = false;
    setSoundPhase('final');
    showView('final');
    focusOn('final');
  }

  // "Skip": fast-forward the burn, or glide the rest of the way up.
  function skipAhead() {
    if (phase === 'burning' && burnControl) {
      burnControl.skip();
    } else if (phase === 'journey' && window.LetGoScene) {
      window.LetGoScene.skipRise();
      clearTimeout(settleTimer);
    }
    btnSkip.blur();
  }

  // ---- Final -> Writing, blank ----
  function returnToQuiet() {
    if (phase !== 'final') { return; }
    phase = 'resetting';
    clearLetter();
    setSoundPhase('writing');
    showView('resetting');
    var back = function () {
      phase = 'writing';
      showView('writing');
      focusOn('writing');
    };
    if (window.LetGoScene) { window.LetGoScene.reset(back); } else { back(); }
  }

  // ---- Wire up the buttons ----
  btnDone.addEventListener('click', goToPreview);
  btnBack.addEventListener('click', goBackToWriting);
  btnBurn.addEventListener('click', burnIt);
  btnSkip.addEventListener('click', skipAhead);
  btnReturn.addEventListener('click', returnToQuiet);

  // Typing again removes the gentle "nothing to burn" note.
  textarea.addEventListener('input', function () {
    if (gentleMessage.textContent !== '') { gentleMessage.textContent = ''; }
  });

  // Enter inside the text box just makes a new line (we add no Enter shortcut).

  // If the browser restores this page from its back/forward cache, start fresh
  // rather than bringing back an old letter or a half-finished sequence.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) { window.location.reload(); }
  });

  // Start every visit with an empty box.
  clearLetter();
})();
