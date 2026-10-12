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
// Static hosts (Netlify, Cloudflare Pages, Vercel) serve /404.html for any
// unmatched path, so it lives at the dist root rather than in a directory.
await buildPage(p('src/404.html'), p('dist/404.html'));
// Page directories can nest (e.g. services/annual-maintenance-contract/).
const findPages = async (dir, rel = '') => {
  const pages = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // A leading underscore marks a directory the build must never emit —
    // src/_drafts/ holds page templates that are queued but must not publish
    // (unverified specs, empty locale pages). Keeping them out of dist/ is the
    // enforcement: there is no way to accidentally ship one.
    if (!entry.isDirectory() || entry.name.startsWith('_') ||
        ['partials', 'css', 'js', 'assets'].includes(entry.name)) continue;
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (await exists(p('src', childRel, 'index.html'))) pages.push(childRel);
    pages.push(...await findPages(p('src', childRel), childRel));
  }
  return pages;
};
const pages = await findPages(p('src'));
for (const page of pages) {
  await buildPage(p('src', page, 'index.html'), p('dist', page, 'index.html'));
}

await cp(p('src/js'), p('dist/js'), { recursive: true });
// _source holds the full-resolution originals for `npm run images`.
// They must never reach dist — the hero original alone is ~1.9MB.
await cp(p('src/assets'), p('dist/assets'), {
  recursive: true,
  filter: (from) => !from.split(/[\\/]/).includes('_source'),
});

// _headers and _redirects are the Netlify/Cloudflare Pages deploy config; they
// are plain files at the publish root and are ignored by hosts that don't use them.
for (const f of ['robots.txt', 'sitemap.xml', 'favicon.ico', 'favicon-192.png', 'apple-touch-icon.png', 'site.webmanifest', '_headers', '_redirects']) {
  if (await exists(p(f))) await cp(p(f), p('dist', f));
}

for (const [from, to] of FONTS) {
  await cp(p('node_modules', from), p('dist/fonts', to));
}

// The sitemap is maintained by hand, so it can drift from reality silently —
// a page gets added and never listed, or a page is removed and the sitemap
// keeps advertising a URL that now 404s. Both are invisible until a crawler
// finds them. Compare the two sets here and fail the build instead.
{
  const ORIGIN = 'https://www.aerolift-cranes.com';
  const sitemap = await readFile(p('sitemap.xml'), 'utf8');
  const listed = new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  );
  // findPages returns 'about', 'products/eot-cranes', … ; the home page is
  // built separately and is always the origin root.
  const built = new Set([`${ORIGIN}/`, ...pages.map((s) => `${ORIGIN}/${s}/`)]);

  const missing = [...built].filter((u) => !listed.has(u));
  const stale = [...listed].filter((u) => !built.has(u));
  if (missing.length || stale.length) {
    throw new Error(
      'sitemap.xml disagrees with the built routes.\n' +
      (missing.length ? `  built but NOT in sitemap: ${missing.join(', ')}\n` : '') +
      (stale.length ? `  in sitemap but NOT built: ${stale.join(', ')}\n` : '') +
      '  Fix sitemap.xml (remember lastmod) or the page, then rebuild.'
    );
  }
  console.log(`sitemap.xml checked: ${listed.size} URLs match the built routes`);
}

console.log('copied static assets -> dist/');
