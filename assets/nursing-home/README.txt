Required JPEGs (1080x1920) live in this folder. Filenames must match exactly.

Real photos (from Cursor workspaceStorage PNGs): from repo root run

  npm run import:assets

That writes 1080x1920 JPEGs with the canonical filenames below (uses long paths
so Windows MAX_PATH is not a problem).

If a file is still missing or under ~4KB, run:

  npm run placeholders

That generates dark-gradient placeholders with the filename drawn on them.

Scroll feed (open from repo root so paths work):

  nursing-home-variations-scroll-feed.html

Regenerate the scroll HTML after editing ads/nursing-home-neglect-variations.json:

  npm run build:scroll

Scroll feed stills (see scripts/build-scroll-feed.js IMAGE_POOL; at most one
nurse_on_phone_ignoring still per 9-beat ad; no duplicate in the four stills).

  daughter_holding_hand.jpg
  nurse_on_phone_ignoring.jpg
  unattended_patient.jpg
  nurse_checking_bedsore.jpg
  call_now_screen.jpg
  elderly_wheelchair_window_dark.jpg
