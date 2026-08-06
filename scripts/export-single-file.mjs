// Builds a fully self-contained one-file preview of the built home page:
// CSS, JS, fonts and every image inlined as data URIs, so the file can be
// emailed or dropped in a chat and opened with a double-click.
// Run `npm run build` first, then `node scripts/export-single-file.mjs`.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const OUT = resolve(root, 'aerolift-home-preview.html');

const MIME = {
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
};

async function dataUri(publicPath) {
  const file = resolve(dist, '.' + publicPath);
  const buf = await readFile(file);
  return `data:${MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'};base64,${buf.toString('base64')}`;
}

let html = await readFile(resolve(dist, 'index.html'), 'utf8');

/* 1. Stylesheet -> <style>, with fonts/images inside the CSS inlined */
let css = await readFile(resolve(dist, 'css/style.css'), 'utf8');
for (const m of [...css.matchAll(/url\((["']?)(\/[^)"']+)\1\)/g)]) {
  css = css.replace(m[0], `url(${await dataUri(m[2])})`);
}
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`);

/* 2. Script -> inline before </body> (it shipped with defer, so it must
      run after the DOM exists) */
const js = await readFile(resolve(dist, 'js/main.js'), 'utf8');
html = html.replace(/<script[^>]*src="\/js\/main\.js"[^>]*><\/script>/, '');
html = html.replace('</body>', `<script>${js}</script>\n</body>`);

/* 3. Preload hints are pointless in a single file */
html = html.replace(/[ \t]*<link[^>]*rel="preload"[^>]*>\r?\n?/g, '');

/* 4. <picture>: drop the <source> variants and inline the webp into the
      <img> itself — one embedded copy per image instead of several */
html = html.replace(/<picture>([\s\S]*?)<\/picture>/g, (_, inner) => inner.replace(/[ \t]*<source[^>]*>\r?\n?/g, '').trim());
for (const m of [...html.matchAll(/(src|href)="(\/assets\/img\/[^"]+)"/g)]) {
  const webp = m[2].replace(/\.(jpg|jpeg|png)$/, '.webp');
  let use = webp;
  try { await stat(resolve(dist, '.' + webp)); } catch { use = m[2]; }
  html = html.replace(m[0], `${m[1]}="${await dataUri(use)}"`);
}

/* 5. Favicons and any other root-absolute asset refs left in <head> */
for (const m of [...html.matchAll(/href="(\/(?:favicon|apple-touch|assets\/)[^"]*)"/g)]) {
  try { html = html.replace(m[0], `href="${await dataUri(m[1])}"`); } catch { /* meta URLs (og:image) keep their absolute form */ }
}

/* 6. Nav links to pages that don't exist yet would 404 from file:// —
      point them at the top of this preview instead */
html = html.replace(/href="\/((?:about|services|products|contact)[^"]*)"/g, 'href="#" data-future-page="/$1"');
/* Root-anchored in-page links (/#request-a-quote) become plain anchors */
html = html.replace(/href="\/#([^"]+)"/g, 'href="#$1"');
html = html.replace(/href="\/"/g, 'href="#"');

/* 7. Preview banner so the client knows what they are looking at */
html = html.replace(/<body([^>]*)>/, `<body$1>
<div style="background:#0F172A;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center;padding:8px 16px">
  Design preview — Aerolift home page. Menu links to other pages are not active in this file.
</div>`);

await writeFile(OUT, html);
const kb = ((await stat(OUT)).size / 1024).toFixed(0);
const leftovers = [...html.matchAll(/(?:src|href)="\/(?!\/)[^"]*"/g)].map(m => m[0]);
console.log(`written: aerolift-home-preview.html (${kb}KB)`);
console.log('remaining root-absolute refs:', leftovers.length ? leftovers.join(', ') : 'none');
