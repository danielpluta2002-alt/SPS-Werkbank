// Lädt die Kern-Quellen (ohne Oberfläche) in einen gemeinsamen Kontext für Tests in Node.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '..', 'src');
const strip = t => { const i = t.indexOf("if (typeof module !== 'undefined')"); return i >= 0 ? t.slice(0, i) : t; };
const code = ['core.js', 'instr.js', 'awl.js', 'example.js'].map(f => strip(fs.readFileSync(path.join(src, f), 'utf8'))).join('\n;\n')
  .replace(/^'use strict';/gm, '');
const ctx = { console, performance, setInterval, clearInterval, Math, JSON };
vm.createContext(ctx);
vm.runInContext(code + `\n;this.api = { lex, Parser, compileProject, PLC, genSource, parseSource, blockGen, buildReg, compileExprString, makeScope, IEC, INS, CATS, newBox, newNet, leaf, netToAwl, awlToNet, parseAwlCode, compileAwlBlock, migrateProject, exampleProject, getDef, boxPins, convertBlock, convertProject };`, ctx);
module.exports = ctx.api;
