// Compiles src/themes/palettes.js into src/styles/themes.generated.css.
import { writeFileSync } from 'node:fs';
import { buildThemeCss } from '../src/themes/palettes.js';

const header = `/* GENERATED FILE: do not edit by hand.
   Source of truth: src/themes/palettes.js   Rebuild: npm run themes:build */\n\n`;
writeFileSync(new URL('../src/styles/themes.generated.css', import.meta.url), header + buildThemeCss());
console.log('themes.generated.css written');
