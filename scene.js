/* =====================================================================
   LET GO — scene.js
   Scatters the stars across the sky. Stars are made here (not typed by
   hand) so they're easy to adjust: change STAR_COUNT or the sky area.
   This file never touches the letter in any way.
   ===================================================================== */
(function () {
  'use strict';

  var STAR_COUNT = 70;
  var SKY_HEIGHT = 430;      // stars only appear above the mountains
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var group = document.getElementById('stars');
  if (!group) { return; }

  // A tiny seeded random generator, so the sky looks the same on every visit
  // (Math.random would give a different sky each time).
  var seed = 20261121;
  function random() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  for (var i = 0; i < STAR_COUNT; i++) {
    var x = random() * 1600;
    var y = random() * SKY_HEIGHT;

    // Keep the stars away from the moon so its glow stays clean.
    var dx = x - 1230, dy = y - 190;
    if (dx * dx + dy * dy < 130 * 130) { continue; }

    var star = document.createElementNS(SVG_NS, 'circle');
    star.setAttribute('cx', x.toFixed(1));
    star.setAttribute('cy', y.toFixed(1));
    star.setAttribute('r', (0.6 + random() * 1.3).toFixed(2));
    star.setAttribute('fill', '#f6efd9');
    var brightness = (0.35 + random() * 0.6).toFixed(2);
    star.setAttribute('opacity', brightness);

    // About one star in five slowly twinkles (see "twinkle" in style.css).
    // Only a few are animated so the sky stays calm while someone writes.
    if (random() < 0.2) {
      star.setAttribute('class', 'twinkle');
      star.style.setProperty('--o', brightness);
      star.style.animationDuration = (5 + random() * 6).toFixed(1) + 's';
      star.style.animationDelay = '-' + (random() * 10).toFixed(1) + 's';  // negative = already mid-twinkle
    }
    group.appendChild(star);
  }
})();
