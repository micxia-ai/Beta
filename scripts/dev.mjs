import { spawn } from 'node:child_process';
const processes = [spawn(process.execPath, ['--watch', 'server/index.mjs'], { stdio: 'inherit' }), spawn('node_modules/.bin/vite', [], { stdio: 'inherit' })];
let closing = false;
function close(code = 0) { if (closing) return; closing = true; processes.forEach(p => p.kill('SIGTERM')); process.exitCode = code; }
processes.forEach(p => { p.on('error', e => { console.error(e); close(1); }); p.on('exit', code => close(code ?? 0)); });
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());
