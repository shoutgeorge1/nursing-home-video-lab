'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'nursing-home-variations-scroll-feed.html'), 'utf8');
const m = html.match(/id="variations-json"[^>]*>(\[[\s\S]*?)\s*<\/script>/);
if (!m) throw new Error('Could not find variations JSON in scroll feed HTML');
const data = JSON.parse(m[1]);
/* No: black_white_elder_drinking (harsh), repositioning (two-staff), duplicate phone. */
const P = {
  h: 'daughter_holding_hand.jpg',
  ph: 'nurse_on_phone_ignoring.jpg', /* at most one per 4-beat set below */
  u: 'unattended_patient.jpg',
  b: 'nurse_checking_bedsore.jpg',
  c: 'call_now_screen.jpg',
  w: 'elderly_wheelchair_window_dark.jpg',
  neutral: 'nurse_checking_bedsore.jpg' /* even slide JSON placeholder, not on-screen for text */
};

/**
 * 4 stills at indices 1,3,5,7. All C(6,4)=15 subsets of {h,ph,u,b,c,w} — at most one ph in each.
 */
const ODD = [
  [P.h, P.ph, P.u, P.b],
  [P.h, P.ph, P.u, P.c],
  [P.h, P.ph, P.u, P.w],
  [P.h, P.ph, P.b, P.c],
  [P.h, P.ph, P.b, P.w],
  [P.h, P.ph, P.c, P.w],
  [P.h, P.u, P.b, P.c],
  [P.h, P.u, P.b, P.w],
  [P.h, P.u, P.c, P.w],
  [P.h, P.b, P.c, P.w],
  [P.ph, P.u, P.b, P.c],
  [P.ph, P.u, P.b, P.w],
  [P.ph, P.u, P.c, P.w],
  [P.ph, P.b, P.c, P.w],
  [P.u, P.b, P.c, P.w]
];
if (data.length !== ODD.length) throw new Error('Variation count ' + data.length + ' != ODD rows ' + ODD.length);
ODD.forEach((row) => {
  if (row.length !== 4) throw new Error('ODD row must have 4');
  if (row.filter((f) => f === P.ph).length > 1) {
    throw new Error('nurse phone duplicated in row: ' + row.join(' '));
  }
});
for (var vi = 0; vi < data.length; vi++) {
  var qu = ODD[vi];
  var v = data[vi];
  for (var si = 0; si < v.slides.length; si++) {
    if (si % 2 === 1) v.slides[si].image = qu[(si - 1) / 2 | 0];
    else {
      v.slides[si].image = si === 8 ? P.c : si === 0 && (vi === 6 || vi === 11) ? P.c : P.neutral;
    }
  }
}
const out = path.join(root, 'ads', 'nursing-home-neglect-variations.json');
fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Wrote ' + out);
