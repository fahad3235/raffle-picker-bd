# Test results — raffle-picker-bd (2026-10-25, 11:00 slot)

## Unit tests — 29/29 passed

`node tests/test_logic.js` — parse/dedupe, bulk-add counts, single-add error
codes (empty / duplicate / too-long), stubbed-random draw indices, no-repeat
vs repeat draw semantics, wheel-landing geometry (winner segment centre lands
exactly on the top pointer after ≥5 turns, verified for pool sizes 2, 3, 8),
Bengali digits, EN→BN string completeness, and strict import validation
(7 rejection cases + 1 acceptance).

## Headless-Chrome smoke — 24/24 passed, 0 console/page errors

`node tests/smoke.js` (raw CDP, `/opt/meta-chromium/chrome`, `file://`) —
title, wheel canvas, spin disabled at 0 names, bulk add of 3 names, a REAL
animated spin (banner winner is a pool name; pool 3→2; winners board 1 row),
quick draw (winners 2 rows; pool 1), reload persistence, বাংলা toggle
(title + persisted lang + Bengali digits), duplicate rejection, typed-DELETE
erase (localStorage key gone), sample loader (8 names), 390px no-overflow,
0 console/page errors.

## Repairs during this run (2 real app bugs, both fixed and re-verified)

1. **Spin animation ReferenceError** — the spin loop was written as a named
   function expression, so the outer `requestAnimationFrame(frame)` threw
   `frame is not defined` (the animation still completed via the inner
   `requestAnimationFrame` call, but a page exception was recorded). Fixed by
   declaring `frame` as a normal function.
2. **390px horizontal overflow (408px)** — `main` was a grid with no explicit
   column, so its implicit `auto` track sized to the cards' max-content and
   overflowed the viewport. Fixed with `grid-template-columns: minmax(0, 1fr)`
   plus `min-width: 0` on cards. Re-verified at 390px with zero overflow.
