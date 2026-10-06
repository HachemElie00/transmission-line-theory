# Checks

Headless Playwright checks that drive the real pages. There is no build step and
no test framework — each file is a plain Node script that prints `ok` / `FAIL`
lines and sets a non-zero exit code if anything fails.

## Running

```bash
cd tests
npm install                  # once: pulls Playwright
npx playwright install chromium   # optional, see "Which browser" below

node run.js                  # everything except the slow solver stage (~4 min)
node run.js --full           # everything, including it (~20 min)
node run.js geometry         # just the suites whose name contains "geometry"
node pages.test.js           # or any single suite directly
```

`run.js` exits non-zero if any suite fails, so it works as a pre-commit or CI
step unchanged.

## What each suite covers

| file | checks |
|---|---|
| `palette.test.js` | every colour token defined in both themes; each contrasts with the figure background; colours that share a figure stay perceptually apart; the teal is confined to the Smith chart; dark is still the base theme. No browser — runs in under a second |
| `chrome.test.js` | `site.js` is pure ASCII; sidebar collapse, persistence, and the narrow-viewport fallback; collapsing actually buys chart width; every figure has a toolbar with symbol-only play/pause |
| `toggles.test.js` | fine grid changes the render in all three grid modes and restores it exactly; zoom reset is pixel-identical; centre-click still reads matched under magnification; theme switch changes and persists |
| `geometry.test.js` | chart and radially scaled parameters share left edge, right edge and width at four viewports; the rim sweep spans the arc the travel distance implies |
| `pages.test.js` | all 16 pages × 7 widths from `file://`: no errors, no blank canvas, no overflow, correct `<head>` (doctype, lang, charset, viewport), all maths typeset, zero external requests — plus one mobile-emulated pass at 390px |
| `offline.test.js` | the same over HTTP with every foreign origin aborted, plus per-page MathJax output and font-load counts |
| `solvers.test.js` | the two-stage solver verification (below) |
| `scenarios.test.js` | every practice scenario worked step by step — 13 loads × five methods × shorted/open × both admittance conventions × both designs, about 280 runs on one page. At each step the chart's own `data-drawn` (point, attempt marker, ring marks, stub arc) is held against values computed in the file: the marker starts on the point, switching shorted/open moves nothing, the turned view marks the turned point, a half-length stub stays on the target circle, the finished design lands at the centre and stays matched through a type switch and a turn back. Each of those was confirmed to fail with its original bug put back. Also: the solution picker beside the miniature circuit leaves the page exactly as the matching "show" button does, travels to the crossing the theory gives, stays hidden while practising until "show me", and then carries the reader's fields with it; and the travel slider, at the page's own step, can reach the 1% acceptance for every load without dragging (at 0.001λ it could not for four of them). The solved shunt view is checked under both conventions, and the L-network is worked by hand on the impedance chart for every distinct design of every load: series first, turn, shunt; or turn, shunt, turn back, series — the marker, attempt, half turns, guide circles and ticks held against the theory at every step |
| `construction.test.js` | the SOLVED construction, mark by mark, for 23 loads × every method × shorted/open × both conventions (impedance chart: shunt work on the turned point; admittance chart: nothing turned) × every design — about 900 drawings. Every path starts and ends where the design puts it, never leaves the circle the theory names, and runs the right way (travel clockwise by exactly 4πd); every half turn is a diameter from the right point, and only the turns the convention calls for are drawn; auxiliary and forbidden circles are the right loci the right way up; the stub's rim arc starts at its own termination and ends where the rim presents what the stub must supply; marker and ring marks sit at the drawn point; the words round the chart say true things about the grid in view; readouts, cards, picker and both circuit drawings carry the design's values, with part symbols matching their signs. Expected values come from `lib/tline.js` and textbook circle geometry only. Also: no solution for matched and purely reactive loads, the forbidden region exactly where theory puts it, a single-element L-network shown once as one element, and an exact half (0.1875λ) printed as 0.188. Mutation-tested: 25 bugs put back, all caught |
| `readouts.test.js` | everything read off the chart for you. The radially scaled ruler: every tick of all six scales at x0 + (x1 − x0)·|Γ(t)| from the scale's definition, the scale spanning the chart's diameter, the cursor at |Γ|, and each live value the definition at |Γ| to its printed precision. The readout row: z, y, Γ, τ, SWR, return and mismatch loss, reflected power, the distances to the first voltage minimum and maximum (found by scanning \|1 + Γ(d)\| along the line, not by formula) and the wavelength-scale reading, over 25 loads (including the rim and the centre) × 6 travel distances. The response plot: for every method, stub type and design of 20 loads, at three SWR limits, the plotted curve against an independent model (tangent formula at electrical lengths scaled by f/f0; L-network elements scaled as the inductors and capacitors they are), the band edges against a scan ten times finer plus bisection, the sentence under the plot, the readout bandwidth, the other design where there are exactly two, and the frequency axis. Mutation-tested |
| `chart.test.js` | the printed chart: every number on the four rim scales at the angle its definition gives (WTG 0 at the short and clockwise, WTL counter-clockwise, reflection angle = arg Γ, transmission angle = arg(1 + e^{jθ})); and a colour-free pixel probe of the grid — rendered with the impedance grid and with the admittance grid, differenced, and required to differ exactly where theory puts each r circle and x arc and nowhere between them, at zoom 1 and magnified and panned. Mutation-tested: a 0.012 shift in one circle's centre, a 2% arc radius error, an unturned admittance grid, a reversed wavelength scale, an unhalved transmission scale and a wrong pan sign are all caught |

## Which browser

`H.launch()` tries Playwright's bundled Chromium, then an installed Chrome,
then Edge, and prints which one it got. `npx playwright install chromium`
downloads from `cdn.playwright.dev`, which is not reachable on every network
even where the npm registry is; without the fallback the whole suite would be
unrunnable there, which is a poor trade for checks that only need a Chromium
engine. Force one with `TLT_BROWSER=chrome|msedge|chromium`.

## Two rules for writing checks here

Both of these produced failures that pointed at the site when the fault was in
the test.

1. **Never sleep a fixed time after clicking a control and then hash the
   canvas.** Read too early and you get the *previous* render, which is
   indistinguishable from a control that did not restore what it found. Use
   `H.settle(page, id, from)`: it waits for the render to change and then to
   stop changing. A fixed 450ms was enough for two grid modes and not the
   third, and inserting a debug print between the click and the read was enough
   to make it pass.
2. **Never return a whole RGBA `ImageData` array through `page.evaluate`.** At
   around three million elements it comes back mangled, and a pixel diff over
   it silently reports *zero differences* — the most misleading possible
   answer. Reduce in the page and return one channel.

## Why these, and not unit tests

Every check here exists because something broke in a way a unit test would have
missed.

- **Pixels, not code.** A drawing function can be correct and still produce
  nothing — wrong transform, zero-sized canvas, a colour that matches the
  background. `geometry.test.js` samples the rendered canvas; `pages.test.js`
  detects a canvas whose pixels are all one value.
- **Hashes for controls.** A toggle that silently does nothing looks fine in
  review. `toggles.test.js` hashes the canvas with the control off and on: the
  hashes must differ, and toggling back must return the *original* hash.
- **The wire is cut, not inspected.** "No CDN links in the markup" is not the
  claim being made. `pages.test.js` and `offline.test.js` abort every request
  that is not local and assert that none was attempted, then confirm the maths
  and fonts still rendered.

## The two-stage solver check

`lib/tline.js` is a second, independent implementation of the matching
mathematics. It shares no code with the site, and deliberately takes a different
route: no reflection coefficient anywhere, every impedance moved with the
tangent formula, every stub length found by bisection instead of an arctangent
identity. A sign error in the page's Γ-rotation therefore cannot hide in both.

**Stage 1** designs every network from scratch and re-assembles each one from
its own numbers. The result must be 1 + j0. This is checking the *checker* — if
stage 1 fails, stage 2 means nothing.

> 460 designs, worst |result − 1| = **2.19e-14**

**Stage 2** drives the live workbench, reads the printed answers out of the DOM,
and compares them to the independent designs at the precision the page prints:
three decimals for wavelengths and normalised values, one decimal for ohms. A
gap larger than half the last printed digit is a failure; anything smaller is
rounding.

> 0 disagreements, worst gap **5.0e-4** — exactly half the last digit

Stage 1 alone runs in about a minute:

```bash
node solvers.test.js --stage1
```

## A third thing the suite could not see

`index.html` shipped with no doctype, `lang`, charset or viewport meta while
the other fourteen pages had all four. Seven viewport widths passed it every
time, and they were right to: **desktop Chromium ignores a missing viewport
meta entirely**, so the page laid out at whatever width the context asked for
and there genuinely was no overflow. The symptom only exists on a device that
does mobile layout, where the absent meta means a 980px layout viewport on a
390px screen.

Two changes came out of that, and the lesson generalises: a check that infers
an invariant from a side effect only holds where the side effect is real.

- `pages.test.js` now asserts the four head elements **directly**, on every
  page, rather than inferring them from layout.
- It also runs one pass with `isMobile: true`, which is the only configuration
  in which the viewport meta does anything at all.

## Two harness bugs worth knowing about

Both wasted real time, and both made a broken thing look fine. They are
commented in `lib/tline.js`; do not tidy either away.

1. **Sampling on a round grid loses roots.** If a scan sample lands exactly on a
   root, neither neighbouring interval shows a sign change and the root
   disappears. `roots()` offsets each sample by 0.37 of a step.
2. **Tangential roots have no sign change at all.** Where the curve touches zero
   without crossing — the L-network has these — bracketing finds nothing.
   `touchRoots()` locates local minima of |f| and refines them with a ternary
   search; results are then merged and deduplicated.

A third, less interesting one: an early version set the double-stub spacing but
never passed it into `page.evaluate`, so it silently compared against the
default. The evaluate block now asserts the value took.

## Notes

- `tests/` is inside the published site. GitHub Pages will serve these files as
  static text, which is harmless. Move the folder out or add it to a deploy
  ignore if you would rather it were not public.
- The servers bind to port 0 (a free port chosen by the OS), so suites can run
  at the same time without colliding.
- Reference numbers above were last confirmed on 2026-09-29.
