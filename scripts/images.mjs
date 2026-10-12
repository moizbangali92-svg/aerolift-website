// Regenerates the optimised web images from src/assets/img/_source/.
// Run with `npm run images` after replacing anything in _source.
// Outputs are committed, so a normal build does not need sharp.
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
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

  // AVIF is offered ahead of WebP in the <picture> source order. Quality is
  // set lower than the WebP figure on purpose: AVIF holds detail at numbers
  // that would visibly fall apart in WebP, so matching them would waste bytes.
  const av = await sharp(resolve(src, 'hero-crane-bay.png'))
    .resize({ width: w, withoutEnlargement: true })
    .avif({ quality: 55, effort: 5 })
    .toFile(resolve(out, `hero-crane-bay-${w}.avif`));
  report.push([`hero-crane-bay-${w}.avif`, `${av.width}x${av.height}`, kb(av.size)]);
}
{
  const info = await sharp(resolve(src, 'hero-crane-bay.png'))
    .resize({ width: 1440, withoutEnlargement: true })
    .jpeg({ quality: 76, progressive: true, mozjpeg: true })
    .toFile(resolve(out, 'hero-crane-bay-1440.jpg'));
  report.push(['hero-crane-bay-1440.jpg', `${info.width}x${info.height}`, kb(info.size)]);
}

/* ---- Logo -------------------------------------------------------
   The wordmark is navy with a black keyline on transparency, and it is
   sized by HEIGHT, not width: it is roughly 8:1, and a width-based
   target that suits a photo would leave it a few pixels tall.

   The keyline is part of the artwork — in the supplied file it is 4px
   on a 3741px-wide master, fully opaque, following the contour. It is
   not the 1px edge that lossy colour plus an alpha mask leaves behind,
   so it is kept rather than flattened away; at display size it reads
   as a faint definition on the edge, which is the point of it.

   176px clears 3x the tallest on-page use (the header at md and up,
   40px) with headroom, so a later size bump does not mean regenerating.
   At 9KB the headroom costs less than the round trip would.

   Lossless, not quality-based. A flat-colour shape compresses to almost
   nothing losslessly, and lossy encoding at any setting puts ringing on
   exactly the hard edges a wordmark is made of — worse here, because a
   thin keyline is the first thing a lossy encoder smears. */
{
  const LOGO_HEIGHT = 176;
  // Already trimmed in _source, but alpha-trimming again is free and keeps
  // the output right if the source is ever replaced with a padded export.
  const base = sharp(resolve(src, 'aerolift-logo.png')).trim();

  const png = await base
    .clone()
    .resize({ height: LOGO_HEIGHT, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(out, 'aerolift-logo.png'));
  report.push(['aerolift-logo.png', `${png.width}x${png.height}`, kb(png.size)]);

  // NO WEBP, deliberately. Measured on this artwork at 176px tall:
  //   palette PNG      15.1KB   lossless
  //   WebP lossless    21.1KB   lossless
  //   WebP q90         14.0KB   lossy
  // A <picture> offers WebP first, so the lossless one would make every
  // browser download the LARGER file. The only smaller WebP is lossy, and
  // 1.1KB does not buy smearing the keyline. The PNG is served on its own.
}

/* ---- Product cards ----------------------------------------------
   Cards render at 4:3 (800x600 attributes, object-cover). Emit exactly
   that crop so the browser never does the cropping itself. Sources that
   don't exist yet are skipped — cards fall back to their SVGs. */
// Per-image crop position for sources whose subject is not centred —
// the jib photo is portrait with the beam and branding in the upper half.
const PRODUCT_CROP = { 'product-jib-crane': 'top' };
const PRODUCTS = ['product-eot-crane', 'product-gantry-crane', 'product-jib-crane', 'product-wire-rope-hoist', 'product-crane-spare-parts'];
for (const name of PRODUCTS) {
  const srcFile = resolve(src, `${name}.png`);
  const position = PRODUCT_CROP[name] ?? 'centre';
  try {
    const webp = await sharp(srcFile)
      .resize({ width: 800, height: 600, fit: 'cover', position })
      .webp({ quality: 78, effort: 6 })
      .toFile(resolve(out, `${name}.webp`));
    report.push([`${name}.webp`, `${webp.width}x${webp.height}`, kb(webp.size)]);
    const avif = await sharp(srcFile)
      .resize({ width: 800, height: 600, fit: 'cover', position })
      .avif({ quality: 55, effort: 5 })
      .toFile(resolve(out, `${name}.avif`));
    report.push([`${name}.avif`, `${avif.width}x${avif.height}`, kb(avif.size)]);
    const jpg = await sharp(srcFile)
      .resize({ width: 800, height: 600, fit: 'cover', position })
      .jpeg({ quality: 80, progressive: true, mozjpeg: true })
      .toFile(resolve(out, `${name}.jpg`));
    report.push([`${name}.jpg`, `${jpg.width}x${jpg.height}`, kb(jpg.size)]);
  } catch {
    report.push([`${name}`, '(no source — SVG placeholder stays)', '']);
  }
}

/* ---- Services band ----------------------------------------------
   Portrait crop of the jib/operator photo for the services section.
   Interim asset: same source as the jib product card but a taller,
   operator-centred crop, so the two uses read differently.
   REPLACE the source with a dedicated Aerolift technician/service
   photo when one exists (drop as _source/service-technician.png). */
{
  let svc = resolve(src, 'service-technician.png');
  try { await stat(svc); } catch { svc = resolve(src, 'product-jib-crane.png'); }
  const webp = await sharp(svc)
    .resize({ width: 840, height: 1050, fit: 'cover' })
    .webp({ quality: 78, effort: 6 })
    .toFile(resolve(out, 'service-technician.webp'));
  report.push(['service-technician.webp', `${webp.width}x${webp.height}`, kb(webp.size)]);
  const avif = await sharp(svc)
    .resize({ width: 840, height: 1050, fit: 'cover' })
    .avif({ quality: 55, effort: 5 })
    .toFile(resolve(out, 'service-technician.avif'));
  report.push(['service-technician.avif', `${avif.width}x${avif.height}`, kb(avif.size)]);
  const jpg = await sharp(svc)
    .resize({ width: 840, height: 1050, fit: 'cover' })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toFile(resolve(out, 'service-technician.jpg'));
  report.push(['service-technician.jpg', `${jpg.width}x${jpg.height}`, kb(jpg.size)]);
}

/* ---- Services page: installation photo --------------------------
   Portrait crop of the outdoor gantry shot for the installation block.
   REPLACE with a real installation photo when one exists
   (drop as _source/service-installation.png). */
{
  let inst = resolve(src, 'service-installation.png');
  try { await stat(inst); } catch { inst = resolve(src, 'product-gantry-crane.png'); }
  const webp = await sharp(inst)
    .resize({ width: 840, height: 1050, fit: 'cover' })
    .webp({ quality: 78, effort: 6 })
    .toFile(resolve(out, 'service-installation.webp'));
  report.push(['service-installation.webp', `${webp.width}x${webp.height}`, kb(webp.size)]);
  const avif = await sharp(inst)
    .resize({ width: 840, height: 1050, fit: 'cover' })
    .avif({ quality: 55, effort: 5 })
    .toFile(resolve(out, 'service-installation.avif'));
  report.push(['service-installation.avif', `${avif.width}x${avif.height}`, kb(avif.size)]);
  const jpg = await sharp(inst)
    .resize({ width: 840, height: 1050, fit: 'cover' })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toFile(resolve(out, 'service-installation.jpg'));
  report.push(['service-installation.jpg', `${jpg.width}x${jpg.height}`, kb(jpg.size)]);
}

/* ---- About page: who-we-are photo -------------------------------
   16:9 content crop of the clean EOT bay shot (the hero source has a
   baked-in navy gradient that reads as a blank half in a content card).
   REPLACE the source with a real workshop/team photo when one exists
   (drop as _source/about-team.png). */
{
  let about = resolve(src, 'about-team.png');
  try { await stat(about); } catch { about = resolve(src, 'product-eot-crane.png'); }
  const webp = await sharp(about)
    .resize({ width: 960, height: 540, fit: 'cover' })
    .webp({ quality: 78, effort: 6 })
    .toFile(resolve(out, 'about-who-we-are.webp'));
  report.push(['about-who-we-are.webp', `${webp.width}x${webp.height}`, kb(webp.size)]);
  const avif = await sharp(about)
    .resize({ width: 960, height: 540, fit: 'cover' })
    .avif({ quality: 55, effort: 5 })
    .toFile(resolve(out, 'about-who-we-are.avif'));
  report.push(['about-who-we-are.avif', `${avif.width}x${avif.height}`, kb(avif.size)]);
  const jpg = await sharp(about)
    .resize({ width: 960, height: 540, fit: 'cover' })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toFile(resolve(out, 'about-who-we-are.jpg'));
  report.push(['about-who-we-are.jpg', `${jpg.width}x${jpg.height}`, kb(jpg.size)]);
}

/* ---- Gallery: real site and equipment photographs ----------------
   Client-supplied photographs of Aerolift equipment and Aerolift crews at
   work. Unlike every other image here these are NOT cropped to a fixed
   ratio: they are a mix of portrait and landscape, and the gallery lays
   them out in a masonry column so each keeps its own shape. Cropping a
   real site photo to fit a grid is how you cut the crane out of it.

   Two outputs per photo: a display size for the grid, and a larger JPEG
   for the click-through. Widths are capped at the source width, so a
   720px-wide phone photo is never upscaled into a soft mess. */
const GALLERY = [
  'gallery-portable-gantry-2-5t-twin-hoist',
  'gallery-portable-gantry-5t-workshop',
  'gallery-technicians-on-site',
  'gallery-end-carriage-rigging',
  'gallery-gantry-erection-site',
  'gallery-gantry-erection-assembly',
  'gallery-gantry-frame-lift',
];
for (const name of GALLERY) {
  const srcFile = resolve(src, `${name}.jpg`);
  try {
    const meta = await sharp(srcFile).metadata();
    const displayW = Math.min(900, meta.width);
    const fullW = Math.min(1600, meta.width);

    const avif = await sharp(srcFile).resize({ width: displayW, withoutEnlargement: true })
      .avif({ quality: 55, effort: 5 }).toFile(resolve(out, `${name}.avif`));
    report.push([`${name}.avif`, `${avif.width}x${avif.height}`, kb(avif.size)]);

    const webp = await sharp(srcFile).resize({ width: displayW, withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 }).toFile(resolve(out, `${name}.webp`));
    report.push([`${name}.webp`, `${webp.width}x${webp.height}`, kb(webp.size)]);

    const jpg = await sharp(srcFile).resize({ width: displayW, withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(resolve(out, `${name}.jpg`));
    report.push([`${name}.jpg`, `${jpg.width}x${jpg.height}`, kb(jpg.size)]);

    const full = await sharp(srcFile).resize({ width: fullW, withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(resolve(out, `${name}-full.jpg`));
    report.push([`${name}-full.jpg`, `${full.width}x${full.height}`, kb(full.size)]);
  } catch {
    report.push([name, '(no source — skipped)', '']);
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
