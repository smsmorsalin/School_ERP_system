/*
  @license
	Rollup.js v4.67.5
	Wed, 04 Nov 2026 09:26:19 GMT - commit 6b1937666ffaffd346992115283d63336bd2464a

	https://github.com/rollup/rollup

	Released under the MIT License.
*/
'use strict';

Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

const rollup = require('./shared/rollup.js');
const rollup_js = require('./shared/node-entry.js');
require('./shared/parseAst.js');
require('./native.js');
require('node:path');
require('node:process');
require('path');
require('node:perf_hooks');
require('node:fs/promises');
require('./shared/fsevents-importer.js');



exports.defineConfig = rollup.defineConfig;
exports.rollup = rollup.rollup;
exports.VERSION = rollup_js.VERSION;
exports.watch = rollup_js.watch;
//# sourceMappingURL=rollup.js.map
