/* Places the screenshot, the callouts and the drawing on the quick-guide sheet.

   Everything positional lives in this file, and every panel outline and arrow target is written in
   coordinates local to the screenshot, offset by SHOT at draw time. So when the application window
   changes and a new assets/SwMacroFlow.png is dropped in, only PANELS has to be re-measured - and if
   the new screenshot is a different size, only SHOT moves. Nothing is measured against the sheet.

   The wobble on the outlines and arrows is a seeded PRNG rather than Math.random(), so the render is
   deterministic: run tools/build-guide.mjs twice and the two PNGs are byte-identical. */

/* The sheet is sized around the screenshot rather than the other way round. The screenshot cannot be
   scaled without going soft (see guide.html), so the paper has to be big enough to hold 1066x713 in
   the middle plus a column of handwriting either side and a band above and below. Everything here is
   CSS px; the render doubles all of it. */
const SHEET = { w: 1760, h: 1240 };

/* Where the screenshot's top-left corner sits on the sheet. Its size is NOT set here - the image is
   laid out at its natural 1066x713 so that rendering at 2x doubles it by whole pixels. See the note
   at the top of guide.html before changing this. */
const SHOT = { x: 347, y: 250 };

/* Rectangles inside the screenshot, as [x1, y1, x2, y2] in its own pixels. Left a few pixels short of
   each other where panels touch: MACROS sits directly on top of SCOPE in the window, and two
   outlines sharing an edge read as one box drawn round both. */
const PANELS = {
  macros:     [14, 92, 354, 318],
  inputs:     [360, 92, 700, 322],
  scope:      [10, 336, 700, 655],
  copilot:    [706, 92, 1055, 655],
  instance:   [536, 38, 926, 71],
  headerKeys: [940, 42, 1052, 68],
  run:        [14, 674, 150, 703],
  progress:   [170, 674, 700, 703],
};

const INK = {
  c1: '#e0342a', c2: '#1f9d55', c3: '#2563d9', c4: '#e07a1a',
  c5: '#8b3fd4', c6: '#d81b7a', c7: '#1e63c8', c8: '#7a5c3a',
};

/* Callout boxes: left and top on the sheet, and the width the text wraps at. The bottom is whatever
   the copy needs - nothing here assumes a height, so editing a bullet in guide.html cannot silently
   push text off the paper without it being visible. */
const NOTES = {
  n3:   { left: 292,  top: 96,   width: 812 },
  n4:   { left: 1128, top: 78,   width: 612 },
  n1:   { left: 24,   top: 300,  width: 299 },
  n8:   { left: 1437, top: 268,  width: 299 },
  n5:   { left: 1437, top: 430,  width: 299 },
  n2:   { left: 24,   top: 656,  width: 299 },
  n6:   { left: 40,   top: 1008, width: 430 },
  n7:   { left: 524,  top: 1008, width: 616 },
  tips: { left: 1196, top: 996,  width: 544 },
};

/* Each outline names the panel it rings and the colour it is drawn in. */
const OUTLINES = [
  ['macros', INK.c1], ['scope', INK.c2], ['inputs', INK.c3], ['instance', INK.c4],
  ['headerKeys', INK.c8], ['copilot', INK.c5], ['run', INK.c6], ['progress', INK.c7],
];

/* from and to are sheet coordinates; bend is how far the curve bows out from the straight line,
   signed, so a pair of arrows leaving the same callout can be made to fan rather than overlap. */
const ARROWS = [
  { from: [332, 352],  to: [354, 386],  bend: 22,  color: INK.c1 },
  { from: [332, 710],  to: [352, 664],  bend: 26,  color: INK.c2 },
  { from: [858, 232],  to: [866, 334],  bend: -22, color: INK.c3 },
  { from: [1158, 258], to: [1176, 282], bend: 14,  color: INK.c4 },
  { from: [1432, 296], to: [1406, 306], bend: 11,  color: INK.c8 },
  { from: [1432, 468], to: [1410, 502], bend: 15,  color: INK.c5 },
  { from: [258, 1004], to: [392, 960],  bend: 22,  color: INK.c6 },
  { from: [706, 1004], to: [752, 960],  bend: 16,  color: INK.c7 },
];

const NS = 'http://www.w3.org/2000/svg';

/* mulberry32: small, fast, and identical run to run for a given seed. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toSheet([x1, y1, x2, y2]) {
  return [SHOT.x + x1, SHOT.y + y1, SHOT.x + x2, SHOT.y + y2];
}

function el(name, attrs) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/* A rectangle walked as a jittered polyline, with the stroke carrying on a little past the corner it
   started from - the overshoot is most of what makes a drawn box read as drawn. */
function roughRect(svg, rect, color, seed) {
  const [x1, y1, x2, y2] = rect;
  const random = rng(seed);
  const wobble = 1.5;
  const pad = 5;
  const corners = [
    [x1 - pad, y1 - pad], [x2 + pad, y1 - pad], [x2 + pad, y2 + pad], [x1 - pad, y2 + pad],
  ];

  const points = [];
  for (let side = 0; side < 4; side += 1) {
    const [ax, ay] = corners[side];
    const [bx, by] = corners[(side + 1) % 4];
    const steps = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 42));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      points.push([
        ax + (bx - ax) * t + (random() - 0.5) * wobble * 2,
        ay + (by - ay) * t + (random() - 0.5) * wobble * 2,
      ]);
    }
  }

  // Close the loop and carry on a little past the start, so the ends cross rather than meet - the
  // overshoot is most of what makes a drawn box read as drawn.
  const [sx, sy] = points[0];
  points.push([sx, sy], [sx + 15, sy - 3]);

  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  svg.appendChild(el('path', {
    d, fill: 'none', stroke: color, 'stroke-width': 2.2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.92,
  }));
}

/* A quadratic curve with a drawn arrowhead. The head is angled off the curve's own tangent at its
   end, so it always points into the panel however the curve bows. */
function arrow(svg, { from, to, bend, color }, seed) {
  const random = rng(seed);
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bend + (random() - 0.5) * 2;
  const cy = my + (dx / len) * bend + (random() - 0.5) * 2;

  svg.appendChild(el('path', {
    d: `M${x1},${y1} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2},${y2}`,
    fill: 'none', stroke: color, 'stroke-width': 2.6, 'stroke-linecap': 'round',
  }));

  const angle = Math.atan2(y2 - cy, x2 - cx);
  const head = 12;
  const spread = 0.42;
  for (const side of [-1, 1]) {
    const a = angle + Math.PI + side * spread;
    svg.appendChild(el('path', {
      d: `M${x2},${y2} L${(x2 + Math.cos(a) * head).toFixed(1)},${(y2 + Math.sin(a) * head).toFixed(1)}`,
      fill: 'none', stroke: color, 'stroke-width': 2.6, 'stroke-linecap': 'round',
    }));
  }
}

/* The rule under a heading, drawn rather than bordered so it can overshoot the last letter. */
function underline(node, color, seed) {
  const random = rng(seed);
  const width = node.getBoundingClientRect().width;
  if (!width) return;
  const svg = el('svg', {
    width: width + 14, height: 9, style: 'display:block;margin-top:1px;overflow:visible',
  });
  const points = [];
  const steps = 14;
  for (let i = 0; i <= steps; i += 1) {
    points.push([(width + 10) * (i / steps) - 3, 4 + (random() - 0.5) * 2.4]);
  }
  svg.appendChild(el('path', {
    d: points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    fill: 'none', stroke: color, 'stroke-width': 2.4, 'stroke-linecap': 'round',
  }));
  node.appendChild(svg);
}

function draw() {
  document.body.style.width = `${SHEET.w}px`;
  document.body.style.height = `${SHEET.h}px`;

  const sheet = document.getElementById('sheet');
  sheet.style.width = `${SHEET.w}px`;
  sheet.style.height = `${SHEET.h}px`;

  const shot = document.getElementById('shot');
  shot.style.left = `${SHOT.x}px`;
  shot.style.top = `${SHOT.y}px`;

  for (const [id, box] of Object.entries(NOTES)) {
    const node = document.getElementById(id);
    node.style.left = `${box.left}px`;
    node.style.top = `${box.top}px`;
    node.style.width = `${box.width}px`;
  }

  const svg = document.getElementById('ink');
  svg.setAttribute('width', SHEET.w);
  svg.setAttribute('height', SHEET.h);
  svg.setAttribute('viewBox', `0 0 ${SHEET.w} ${SHEET.h}`);

  let seed = 20250820;
  for (const [name, color] of OUTLINES) roughRect(svg, toSheet(PANELS[name]), color, (seed += 7919));
  for (const spec of ARROWS) arrow(svg, spec, (seed += 7919));

  // Headings rule themselves, in whatever colour their callout is wearing. The tips box is the one
  // exception - it is already inside a drawn border, and a rule as well is one line too many.
  for (const heading of document.querySelectorAll('.note:not(#tips) h2')) {
    underline(heading, getComputedStyle(heading).color, (seed += 7919));
  }
  underline(document.querySelector('#title span'), INK.c1, (seed += 7919));

  // Told apart from a half-drawn page by the renderer, which waits for it.
  document.documentElement.dataset.guideReady = 'true';
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(draw);
} else {
  draw();
}
