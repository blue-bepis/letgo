/* =====================================================================
   LET GO — app.js
   Controls which "state" the visitor is in and handles the letter.

   PRIVACY RULES THIS FILE FOLLOWS
   - The letter lives only in the text box and in the variable `letterText`.
   - It is never saved (no localStorage, sessionStorage, cookies, IndexedDB).
   - It is never sent anywhere (no fetch, XHR, forms, WebSockets).
   - It is never written to the console or put in the address bar.
   - The preview is filled with textContent (never innerHTML), so nothing
     the visitor types can be run as code.
   - clearLetter() wipes everything when the ritual finishes.
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

  // ---- The only place the letter is ever held (memory only) ----
  var letterText = '';

  // Tell the sound system which part of the ritual we're in (it only changes
  // volumes; it never sees the letter). Safe even if sound isn't available.
  function setSoundPhase(name) {
    if (window.LetGoAudio && window.LetGoAudio.setPhase) { window.LetGoAudio.setPhase(name); }
  }

  // ---- Switching between states: fade one view out, the next one in ----
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

  // ---- Writing → Preview ----
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
    showView('preview');
    focusOn('preview');
    $('letter-sheet').scrollTop = 0;
  }

  // ---- Preview → Writing (the text is still in the box, in memory only) ----
  function goBackToWriting() {
    showView('writing');
    window.setTimeout(function () {
      textarea.focus();
      var end = textarea.value.length;
      try { textarea.setSelectionRange(end, end); } catch (e) { /* ignore */ }
    }, 150);
  }

  // ---- Preview → Final ----
  // PHASE 1 STAND-IN: the real throw-into-the-fire animation, burning, and
  // camera journey to the moon arrive in Phase 3. For now, "Burn it away"
  // clears the letter right away and fades to the closing message, so we can
  // already test that nothing is kept.
  var finishing = false;
  function burnIt() {
    if (finishing) { return; }
    finishing = true;
    btnBurn.disabled = true;
    btnBack.disabled = true;
    clearLetter();
    setSoundPhase('final');
    showView('final');
    focusOn('final');
    finishing = false;
    btnBurn.disabled = false;
    btnBack.disabled = false;
  }

  // ---- Final → Writing, blank ----
  function returnToQuiet() {
    clearLetter();
    setSoundPhase('writing');
    showView('writing');
    focusOn('writing');
  }

  // ---- Wire up the buttons ----
  btnDone.addEventListener('click', goToPreview);
  btnBack.addEventListener('click', goBackToWriting);
  btnBurn.addEventListener('click', burnIt);
  btnReturn.addEventListener('click', returnToQuiet);

  // Typing again removes the gentle "nothing to burn" note.
  textarea.addEventListener('input', function () {
    if (gentleMessage.textContent !== '') { gentleMessage.textContent = ''; }
  });

  // Enter inside the text box just makes a new line (we add no Enter shortcut).

  // If the browser restores this page from its back/forward cache, start blank
  // rather than bringing back an old letter.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      clearLetter();
      setSoundPhase('writing');
      showView('writing');
    }
  });

  // Start every visit with an empty box.
  clearLetter();
})();
