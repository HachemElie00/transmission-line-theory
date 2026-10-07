Transmission Line Theory - transmission lines and the Smith chart
(c) 2026 Elie Hachem - all rights reserved

A teaching site on transmission lines, from Maxwell's equations to impedance
matching on the Smith chart. Written for students at any university, as a
companion to a course: it visualises the ideas and goes further than most
courses do, but it is not a replacement for one.

Online:  https://hachemelie00.github.io/transmission-line-theory/
Offline: double-click index.html (see below)


WHAT IS IN IT
-------------
  index.html                  contents
  smith-tool.html             the Smith chart workbench

  Prologue
    P1  prologue-maxwell.html       Maxwell's equations
    P2  prologue-helmholtz.html     The wave equation and Helmholtz

  Chapters
    01  waves-phasors.html          Waves, phasors and complex numbers
    02  circuit-to-line.html        When a circuit becomes a line
    03  telegraphers.html           The transmission line model
    04  propagation.html            Propagation on a line
    05  microstrip.html             Microstrip and real lines
    06  reflection.html             Reflection at a load
    07  standing-waves.html         Standing waves
    08  input-impedance.html        Input impedance
    09  line-lengths.html           Line lengths and transformers
    10  smith-chart.html            The Smith chart
    11  matching.html               Impedance matching

  report.html                 report a mistake (also the bug button at the top
                              of every page)

Every chapter reads straight through without heavy mathematics; the longer
derivations are folded away in "Full derivation" blocks for whoever wants
them. Each chapter ends with conceptual self-checks and ten problems (three
easy, three medium, three hard and one stretch), checked as you type them.

Every figure is computed live in your browser from its inputs. No number on
any page is typed in from a textbook.


THE SMITH CHART WORKBENCH
-------------------------
  - Enter a load as R + jX, |Gamma| and angle, SWR and angle, R + L or R + C;
    or drag it on the chart.
  - Five matching methods: shunt stub, series stub, quarter-wave transformer,
    L-network and double stub, with every solution, shorted or open stubs.
  - Solve on the impedance chart (the paper method: turn the point half a
    turn to y) or on the admittance chart.
  - Watch any solution built step by step: the strip under the chart plays
    the construction one step at a time, in the order chapter 11 teaches it,
    with what each step does and its numbers.
  - Practice mode: travel the line and size the elements yourself; the tool
    checks what you built, not whether it matches one answer.
  - The radially scaled parameters, the circuit, and the frequency response
    and bandwidth of the match.
  - Zoom, full screen for presenting (F), and "copy link", which puts the
    whole problem in the address so it can be shared or put on a slide.


NO INTERNET NEEDED
------------------
Everything the site uses - the equation renderer and the typefaces - is inside
this folder. Nothing is fetched from the network, so it works on a plane, in a
basement, or during an outage. The one exception is the bug report page: its
send button posts your report, and only when you press it. Offline, copy the
report or email it instead. Keep the "assets" folder next to the HTML files or
the maths and figures will not load.

Light and dark themes, and whether the sidebar is shown, are remembered from
page to page (the buttons in the top bar).


FOUND A MISTAKE?
----------------
Press the bug button at the top of any page. The report carries the page you
were on - and on the workbench the exact state of the chart - so it can be
reproduced. Anything from a wrong number to an unclear sentence is worth
reporting.


FOR ANYONE EDITING THE SITE
---------------------------
There is no build step: every page is a plain HTML file that runs as it is.

  assets/site.css        the shared design (light and dark palettes)
  assets/site.js         navigation, theme, figure engine (keep it pure ASCII)
  assets/problems.js     the problems; answers are computed, never written down
  assets/search-index.js generated: node tools/build-search-index.js
  assets/mathjax/, assets/fonts/   bundled so the site works offline
  tests/                 the checks (they need Node and Playwright)

Rules the site keeps:
  - Nothing is loaded from another site when a page opens.
  - Every figure computes what it shows; nothing is typed in.
  - Page text never names a colour (say what a mark is, not its colour).
  - No Unicode subscript or superscript characters; use <sub> and <sup>.

The checks drive the real pages in a headless browser and compare every
figure, readout and construction against values derived independently:

  cd tests
  npm install
  node run.js            everything but the slowest stage (about 20 minutes)
  node run.js --full     everything
  node run.js ch07       one suite, by name

tests/README.md says what each suite covers.
