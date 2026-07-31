// Regenerates the optimised web images from src/assets/img/_source/.
// Run with `npm run images` after replacing anything in _source.
// Outputs are committed, so a normal build does not need sharp.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src/assets/img/_source');
const out = resolve(root, 'src/assets/img');
await mkdir(out, { recursive: true });

const kb = (n) => (n / 1024).toFixed(1) + 'KB';
const report = [];

/* ---- Hero -------------------------------------------------------
   Three widths for srcset. WebP is the real delivery format; one JPG
   is kept as the fallback for anything that cannot take WebP. */
// 1672 is the source width — asking for more would only upscale.
const HERO_WIDTHS = [960, 1440, 1672];
for (const w of HERO_WIDTHS) {
  const info = await sharp(resolve(src, 'hero-crane-bay.png'))
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: 72, effort: 6 })
    .toFile(resolve(out, `hero-crane-bay-${w}.webp`));
  report.push([`hero-crane-bay-${w}.webp`, `${info.width}x${info.height}`, kb(info.size)]);
}
{
  const info = await sharp(resolve(src, 'hero-crane-bay.png'))
    .resize({ width: 1440, withoutEnlargement: true })
    .jpeg({ quality: 76, progressive: true, mozjpeg: true })
    .toFile(resolve(out, 'hero-crane-bay-1440.jpg'));
  report.push(['hero-crane-bay-1440.jpg', `${info.width}x${info.height}`, kb(info.size)]);
}

/* ---- Logo -------------------------------------------------------
   Trimmed to the artwork, then emitted at 3x the largest on-page size
   so it stays crisp on high-DPI screens. The source is a JPEG on a
   white field, so a PNG output keeps the edges clean without trying
   to key out the background (JPEG ringing would leave a halo). */
{
  const base = sharp(resolve(src, 'aerolift-logo.jpg'))
    .trim({ background: '#ffffff', threshold: 12 });

  const png = await base
    .clone()
    .resize({ width: 480, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(out, 'aerolift-logo.png'));
  report.push(['aerolift-logo.png', `${png.width}x${png.height}`, kb(png.size)]);

  const webp = await base
    .clone()
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 90, effort: 6 })
    .toFile(resolve(out, 'aerolift-logo.webp'));
  report.push(['aerolift-logo.webp', `${webp.width}x${webp.height}`, kb(webp.size)]);
}

/* ---- Product cards ----------------------------------------------
   Cards render at 4:3 (800x600 attributes, object-cover). Emit exactly
   that crop so the browser never does the cropping itself. Sources that
   don't exist yet are skipped — cards fall back to their SVGs. */
const PRODUCTS = ['product-eot-crane', 'product-gantry-crane', 'product-jib-crane', 'product-wire-rope-hoist', 'product-crane-spare-parts'];
for (const name of PRODUCTS) {
  const srcFile = resolve(src, `${name}.png`);
  try {
    const webp = await sharp(srcFile)
      .resize({ width: 800, height: 600, fit: 'cover' })
      .webp({ quality: 78, effort: 6 })
      .toFile(resolve(out, `${name}.webp`));
    report.push([`${name}.webp`, `${webp.width}x${webp.height}`, kb(webp.size)]);
    const jpg = await sharp(srcFile)
      .resize({ width: 800, height: 600, fit: 'cover' })
      .jpeg({ quality: 80, progressive: true, mozjpeg: true })
      .toFile(resolve(out, `${name}.jpg`));
    report.push([`${name}.jpg`, `${jpg.width}x${jpg.height}`, kb(jpg.size)]);
  } catch {
    report.push([`${name}`, '(no source — SVG placeholder stays)', '']);
  }
}

/* ---- Open Graph card -------------------------------------------- */
{
  const info = await sharp(resolve(src, 'hero-crane-bay.png'))
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'right' })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(resolve(out, 'og-aerolift-lifting-equipment-uae.jpg'));
  report.push(['og-aerolift-lifting-equipment-uae.jpg', `${info.width}x${info.height}`, kb(info.size)]);
}

console.log('generated:');
for (const [name, dims, size] of report) {
  console.log('  ' + name.padEnd(42) + dims.padEnd(12) + size);
}
