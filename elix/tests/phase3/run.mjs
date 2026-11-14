// Runs the Phase 3 tests:  node tests/phase3/run.mjs   (needs the project's dev dependencies: npm install)
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
let esbuild;
try { esbuild = await import('esbuild'); } catch { esbuild = await import('/opt/npm-tools/node_modules/esbuild/lib/main.js'); }
const here = path.dirname(fileURLToPath(import.meta.url));
const fake = path.join(here, 'fakeSupabase.js');
const out = process.env.PHASE3_OUT || path.join(here, '.phase3-test.bundle.mjs');
await esbuild.build({
  entryPoints: [path.join(here, 'entry.js')], bundle: true, platform: 'node', format: 'esm', outfile: out,
  loader: { '.js': 'jsx' }, nodePaths: ['/opt/npm-tools/node_modules'], logLevel: 'error',
  external: ['react', 'react-dom', 'motion/react', 'react-router-dom', 'lucide-react'],
  define: { 'import.meta.env': '{}', 'import.meta.glob': '__glob' },
  banner: { js: "globalThis.__glob=()=>({});import {createRequire} from 'module';const require=createRequire(import.meta.url);" },
  plugins: [{ name: 'stand-ins', setup(b) {
    b.onResolve({ filter: /(^|\/)lib\/supabase$|^\.\/supabase$/ }, () => ({ path: fake }));
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: readFileSync(a.path, 'utf8'), loader: 'text' }));
  } }],
});
process.exit(spawnSync(process.execPath, [out], { stdio: 'inherit', cwd: here }).status ?? 1);
