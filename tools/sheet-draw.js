/* Draws a handwritten sheet: places the screenshot, lays out the callouts, and inks the outlines,
   arrows and underlines over the top.

   Every sheet in tools/ - the quick guide and the three settings sheets - is the same page with a
   different config, so this file holds no coordinates of its own. A sheet is an HTML file with the
   callout copy in it, ending in:

       <script src="sheet-draw.js"></script>
       <script>drawSheet({ ... })</script>

   Panel rectangles in a config are written in coordinates local to the screenshot and offset by
   config.shot at draw time, so when a new screenshot is dropped in only `panels` has to be
   re-measured - and if it is a different size, only `shot` moves. Arrows are the one exception: they
   are in sheet coordinates, because both of their ends are usually off the screenshot.

   The wobble on the outlines and arrows is a seeded PRNG rather than Math.random(), so the render is
   deterministic: run tools/build-guide.mjs twice and the two PNGs are byte-identical. That is also
   what makes a diff on a sheet PNG mean something. */

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

function toSheet([x1, y1, x2, y2], shot) {
  return [shot.x + x1, shot.y + y1, shot.x + x2, shot.y + y2];
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

/* config:
     sheet      { w, h }          the paper, in CSS px. Must match this sheet's entry in build-guide.mjs.
     shot       { x, y }          where the screenshot's top-left corner sits. Its SIZE is never set -
                                  the image lays out at its natural size so the 2x render doubles it
                                  by whole pixels and the UI text inside stays sharp.
     panels     { name: rect }    rectangles inside the screenshot, [x1, y1, x2, y2] in its own px.
     notes      { id: box }       callout placement, { left, top, width } on the sheet. No height:
                                  copy that outgrows its box spills visibly rather than being clipped.
     outlines   [[name, ink]]     which panel to ring, and in what colour.
     arrows     [{ from, to, bend, color }]   from/to in SHEET coordinates; bend is signed, so two
                                  arrows leaving one callout can be fanned apart.
     titleInk   colour            the rule under the sheet title.
     titleWidth number            optional; the band the title centres in. Defaults to the sheet width.
     seed       number            optional; changing it redraws every wobble. */
function paintSheet(config) {
  const { sheet, shot, panels, notes, outlines, arrows } = config;

  document.body.style.width = `${sheet.w}px`;
  document.body.style.height = `${sheet.h}px`;

  const sheetNode = document.getElementById('sheet');
  sheetNode.style.width = `${sheet.w}px`;
  sheetNode.style.height = `${sheet.h}px`;

  const shotNode = document.getElementById('shot');
  shotNode.style.left = `${shot.x}px`;
  shotNode.style.top = `${shot.y}px`;

  const title = document.getElementById('title');
  title.style.width = `${config.titleWidth || sheet.w}px`;

  for (const [id, box] of Object.entries(notes)) {
    const node = document.getElementById(id);
    node.style.left = `${box.left}px`;
    node.style.top = `${box.top}px`;
    node.style.width = `${box.width}px`;
  }

  const svg = document.getElementById('ink');
  svg.setAttribute('width', sheet.w);
  svg.setAttribute('height', sheet.h);
  svg.setAttribute('viewBox', `0 0 ${sheet.w} ${sheet.h}`);

  let seed = config.seed || 20250820;
  for (const [name, color] of outlines) roughRect(svg, toSheet(panels[name], shot), color, (seed += 7919));
  for (const spec of arrows) arrow(svg, spec, (seed += 7919));

  // Headings rule themselves, in whatever colour their callout is wearing. The tips box is the one
  // exception - it is already inside a drawn border, and a rule as well is one line too many.
  for (const heading of document.querySelectorAll('.note:not(#tips) h2')) {
    underline(heading, getComputedStyle(heading).color, (seed += 7919));
  }
  underline(document.querySelector('#title span'), config.titleInk, (seed += 7919));

  // Told apart from a half-drawn page by the renderer, which waits for it.
  document.documentElement.dataset.guideReady = 'true';
}

/* Sheets call drawSheet() straight from a script tag rather than being handed the config here, so
   each sheet's numbers live in the sheet. The font gate is the one thing they should not each have
   to remember: measuring a heading before Caveat loads rules it at the fallback's width. */
window.drawSheet = (config) => {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => paintSheet(config));
  } else {
    paintSheet(config);
  }
};
