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

// HTML pages: src/index.html and src/<slug>/index.html, with build-time
// partial expansion. `<!-- @include name -->` splices src/partials/name.html;
// `<!-- @nav key -->` marks the active nav item — the matching
// data-nav="key" anchors get aria-current="page".
import { readdir } from 'node:fs/promises';
const partialCache = {};
const partial = async (name) => {
  if (!(name in partialCache)) {
    partialCache[name] = await readFile(p('src/partials', `${name}.html`), 'utf8');
  }
  return partialCache[name];
};
const buildPage = async (srcFile, outFile) => {
  let html = await readFile(srcFile, 'utf8');
  const missing = [];
  for (const m of [...html.matchAll(/<!-- @include ([\w-]+) -->/g)]) {
    const body = await partial(m[1]).catch(() => null);
    if (body === null) { missing.push(m[1]); continue; }
    html = html.replace(m[0], body.trimEnd());
  }
  if (missing.length) throw new Error(`${srcFile}: unknown partial(s): ${missing.join(', ')}`);
  const nav = html.match(/<!-- @nav (\w+) -->\r?\n?/);
  if (nav) {
    html = html.replace(nav[0], '');
    html = html.replaceAll(`data-nav="${nav[1]}"`, `data-nav="${nav[1]}" aria-current="page"`);
  }
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, html);
};
await buildPage(p('src/index.html'), p('dist/index.html'));
for (const entry of await readdir(p('src'), { withFileTypes: true })) {
  if (!entry.isDirectory() || ['partials', 'css', 'js', 'assets'].includes(entry.name)) continue;
  if (await exists(p('src', entry.name, 'index.html'))) {
    await buildPage(p('src', entry.name, 'index.html'), p('dist', entry.name, 'index.html'));
  }
}

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

console.log('copied static assets -> dist/');
