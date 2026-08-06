// Builds a file://-friendly copy of dist/ and zips it for client hand-off.
// Root-absolute URLs break when a site is browsed from an unzipped folder,
// so every internal URL is rewritten relative to its page's depth and
// directory links gain an explicit index.html.
// Run `npm run build` first, then `node scripts/export-portable.mjs`.
import { cp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const out = resolve(root, 'aerolift-site-preview');
const zip = resolve(root, 'aerolift-site-preview.zip');

await rm(out, { recursive: true, force: true });
await rm(zip, { force: true });
await cp(dist, out, { recursive: true });

const htmlFiles = [];
const walk = async (dir) => {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) await walk(f);
    else if (e.name.endsWith('.html')) htmlFiles.push(f);
  }
};
await walk(out);

const rewriteUrl = (url, prefix) => {
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  let [path, hash] = url.split('#');
  path = path.replace(/^\//, '');
  if (path === '' ) path = 'index.html';
  else if (path.endsWith('/')) path += 'index.html';
  return prefix + path + (hash !== undefined ? '#' + hash : '');
};

for (const file of htmlFiles) {
  const depth = file.slice(out.length + 1).split(/[\\/]/).length - 1;
  const prefix = depth === 0 ? '' : '../'.repeat(depth);
  let html = await readFile(file, 'utf8');
  // href/src/poster/action attributes
  html = html.replace(/\b(href|src|poster|action)="(\/[^"]*)"/g,
    (_, attr, url) => `${attr}="${rewriteUrl(url, prefix)}"`);
  // srcset lists
  html = html.replace(/\bsrcset="([^"]+)"/g, (_, list) =>
    `srcset="${list.split(',').map(part => {
      const [u, size] = part.trim().split(/\s+/);
      return [rewriteUrl(u, prefix), size].filter(Boolean).join(' ');
    }).join(', ')}"`);
  // imagesrcset on preload links
  html = html.replace(/\bimagesrcset="([^"]+)"/g, (_, list) =>
    `imagesrcset="${list.split(',').map(part => {
      const [u, size] = part.trim().split(/\s+/);
      return [rewriteUrl(u, prefix), size].filter(Boolean).join(' ');
    }).join(', ')}"`);
  // CSS url() in inline styles (none today, cheap insurance)
  await writeFile(file, html);
}

// The stylesheet references /fonts/… — rewrite to relative (CSS sits in /css/)
const cssFile = join(out, 'css', 'style.css');
let css = await readFile(cssFile, 'utf8');
css = css.replaceAll('url(/fonts/', 'url(../fonts/');
css = css.replaceAll('url("/fonts/', 'url("../fonts/');
await writeFile(cssFile, css);

execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${out}\\*' -DestinationPath '${zip}' -Force"`);
const size = (await readFile(zip)).length;
console.log(`pages rewritten: ${htmlFiles.length}`);
console.log(`written: aerolift-site-preview.zip (${(size / 1024).toFixed(0)}KB)`);
