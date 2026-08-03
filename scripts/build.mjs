// Copies static sources into /dist. Tailwind CLI writes dist/css/style.css separately.
// No dependencies beyond Node core.
import { cp, mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const p = (...s) => resolve(root, ...s);

// Self-hosted fonts pulled from the @fontsource packages so the woff2 files are
// versioned by npm rather than committed by hand.
const FONTS = [
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', 'ibm-plex-sans-400.woff2'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2', 'ibm-plex-sans-500.woff2'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2', 'ibm-plex-sans-600.woff2'],
  ['@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2', 'barlow-condensed-600.woff2'],
  ['@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2', 'barlow-condensed-700.woff2'],
];

const exists = async (f) => stat(f).then(() => true, () => false);

await rm(dist, { recursive: true, force: true });
if (process.argv.includes('--clean')) process.exit(0);

await mkdir(p('dist/css'), { recursive: true });
await mkdir(p('dist/fonts'), { recursive: true });

// HTML: src/index.html -> dist/index.html (future pages map to dist/<slug>/index.html)
await cp(p('src/index.html'), p('dist/index.html'));

await cp(p('src/js'), p('dist/js'), { recursive: true });
// _source holds the full-resolution originals for `npm run images`.
// They must never reach dist — the hero original alone is ~1.9MB.
await cp(p('src/assets'), p('dist/assets'), {
  recursive: true,
  filter: (from) => !from.split(/[\\/]/).includes('_source'),
});

for (const f of ['robots.txt', 'sitemap.xml', 'favicon.svg', 'site.webmanifest']) {
  if (await exists(p(f))) await cp(p(f), p('dist', f));
}

for (const [from, to] of FONTS) {
  await cp(p('node_modules', from), p('dist/fonts', to));
}

// Strip build-only comments (REPLACE / PLACEHOLDER notes stay — they are for the client).
const html = await readFile(p('dist/index.html'), 'utf8');
await writeFile(p('dist/index.html'), html);

console.log('copied static assets -> dist/');
