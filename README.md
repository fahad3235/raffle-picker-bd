# Raffle Picker BD

An offline, bilingual (English / বাংলা) spinning-wheel raffle picker for classrooms,
offices, weddings, and community events in Bangladesh. Paste a list of names, spin
the wheel, and draw fair winners — everything runs in the browser, with no server
and no network requests.

## Features

- **Spinning wheel** — canvas wheel with one coloured segment per name, a pointer,
  and a 4.5-second eased spin animation.
- **Fair draws** — the winner is chosen first with `crypto.getRandomValues`, and the
  wheel animation is then aimed at that winner's segment. The wheel never decides
  the outcome; it only displays it.
- **Quick draw** — draw 1–10 winners instantly, without animation.
- **No-repeat mode** — drawn winners leave the pool (toggleable; off = names can
  be drawn again).
- **Winners board** — every winner in draw order with the time drawn; reset
  returns winners to the pool.
- **Name management** — bulk paste (one per line), single add, per-name remove,
  duplicate / length / 200-name limits with inline errors, and a labelled sample
  list (examples only).
- **Data portability** — JSON export and strict import (malformed files are
  rejected with data intact), typed-DELETE erase-all.
- **Bilingual UI** — EN / বাংলা toggle persisted across reloads, with Bengali
  digits for counts in বাংলা mode.
- **Mobile friendly** — verified at 390px width with no horizontal overflow.

## Stack

Vanilla HTML, CSS, and JavaScript. No build step, no dependencies, no framework.
State is kept in `localStorage` under `raffle-picker-bd-v1`.

## Run locally

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Tests

```sh
node tests/test_logic.js   # 29 pure-logic checks
node tests/smoke.js        # 24 headless-Chrome (CDP) checks, uses /opt/meta-chromium/chrome
```

The smoke test drives the real UI: bulk add, a full animated spin (winner must be
a pool name, pool shrinks by one in no-repeat mode), quick draw, reload
persistence, বাংলা toggle, duplicate rejection, typed-DELETE erase, sample
loader, and the 390px overflow check.

## Design notes

- **Winner-first spin:** `targetRotation()` in `logic.js` computes the rotation
  that puts the chosen segment's centre under the top pointer after at least
  five full turns. Unit tests assert this geometry exactly for pool sizes 2, 3,
  and 8.
- **Randomness:** `secureRandomIndex()` uses `crypto.getRandomValues` in the
  browser and accepts an injectable random function for tests.
- **No-repeat accounting:** in no-repeat mode a quick draw of N is capped at
  the pool size; in repeat mode the same name may be drawn multiple times.

## Limitations

- This is a personal raffle tool for fun and classroom / event use. It is not a
  lottery, gambling, or certified random-draw service, and results carry no
  legal weight.
- Names are stored only in the browser's `localStorage`; clearing browser data
  erases them. Export JSON regularly for lists you want to keep.
- The sample names are examples only — replace them with your own list.

## Status

Working MVP, tested green (see `TEST_RESULTS.md`). Contributions welcome via
issues and pull requests.
