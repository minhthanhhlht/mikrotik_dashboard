import { parseDuration, formatDuration, formatBytes } from '../frontend/src/utils/format.js';

const tests = ['1d', '2w', '1w2d', '00:30:00', '1d02:12:01', '3h4m5s', '30m', '', '5d21:47:59', '2h'];
for (const v of tests) {
  console.log(JSON.stringify(v).padEnd(14), 'sec =', String(parseDuration(v)).padStart(7), '->', formatDuration(v));
}
console.log('---');
for (const b of [1073741824, 0, '5234123', 2904412234, '']) {
  console.log(String(JSON.stringify(b)).padEnd(14), '->', formatBytes(b));
}