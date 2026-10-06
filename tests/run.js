/* Runs the checks in order and reports. Exits non-zero if any fail.

     node tests/run.js           everything except the slow solver stage 2
     node tests/run.js --full    everything, including it (~15-20 min)
     node tests/run.js geometry  just the ones whose name contains "geometry"
*/

const { spawnSync } = require('child_process');
const path = require('path');

const ALL = [
  /* palette first: it needs no browser, takes well under a second, and a
     broken colour token would make several of the later suites fail in ways
     that look like drawing bugs */
  ['palette',  'palette.test.js',  []],
  ['content',  'content.test.js',  []],
  ['problems', 'problems.test.js', []],
  ['search',   'search.test.js',   []],
  ['practice', 'practice.test.js', []],
  ['scenarios','scenarios.test.js',[]],
  ['construction','construction.test.js',[]],
  ['chart',    'chart.test.js',    []],
  ['readouts', 'readouts.test.js', []],
  ['response', 'response.test.js', []],
  ['chrome',   'chrome.test.js',   []],
  ['toggles',  'toggles.test.js',  []],
  ['geometry', 'geometry.test.js', []],
  ['pages',    'pages.test.js',    []],
  ['offline',  'offline.test.js',  []],
  ['solvers',  'solvers.test.js',  ['--stage1']]   /* stage 2 only with --full */
];

const args = process.argv.slice(2);
const full = args.includes('--full');
const filter = args.filter(a => !a.startsWith('--'));

const picked = ALL.filter(([name]) => !filter.length || filter.some(f => name.includes(f)));

const results = [];
for (const [name, file, extra] of picked){
  const argv = [path.join(__dirname, file)].concat(full ? [] : extra);
  console.log('\n── ' + name + ' ' + '─'.repeat(Math.max(0, 58 - name.length)));
  const t = Date.now();
  const r = spawnSync(process.execPath, argv, { stdio: 'inherit' });
  results.push([name, r.status === 0, ((Date.now() - t)/1000).toFixed(0) + 's']);
}

console.log('\n' + '═'.repeat(62));
results.forEach(([name, ok, t]) =>
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name.padEnd(14) + t.padStart(6)));

const failed = results.filter(r => !r[1]).length;
console.log(failed ? '\n' + failed + ' suite(s) failed.' : '\nall suites passed.');
if (!full) console.log('(solver stage 2 skipped - run with --full)');
process.exit(failed ? 1 : 0);
