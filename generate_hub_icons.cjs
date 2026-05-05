/**
 * Generate CRM Hub launcher icons for all Android mipmap densities.
 *
 * Design: Deep blue (#1E3A8A) background, white 4-tile dashboard grid
 *         with a light-blue (#60A5FA) center hub dot.
 *
 * Usage: node generate_hub_icons.cjs
 *
 * Requires: sharp (npm install sharp --no-save)
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const RES_DIR = path.join(
  __dirname, 'android', 'app', 'src', 'main', 'res'
);

const SIZES = {
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
};

// ---- SVG templates ----

function iconSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
  <rect width="108" height="108" fill="#1E3A8A"/>
  <rect x="31" y="31" width="20" height="20" rx="4" fill="#fff"/>
  <rect x="57" y="31" width="20" height="20" rx="4" fill="#fff"/>
  <rect x="31" y="57" width="20" height="20" rx="4" fill="#fff"/>
  <rect x="57" y="57" width="20" height="20" rx="4" fill="#fff"/>
  <circle cx="54" cy="54" r="4" fill="#60A5FA"/>
</svg>`;
}

function roundIconSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
  <defs><clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="108" height="108" fill="#1E3A8A"/>
    <rect x="31" y="31" width="20" height="20" rx="4" fill="#fff"/>
    <rect x="57" y="31" width="20" height="20" rx="4" fill="#fff"/>
    <rect x="31" y="57" width="20" height="20" rx="4" fill="#fff"/>
    <rect x="57" y="57" width="20" height="20" rx="4" fill="#fff"/>
    <circle cx="54" cy="54" r="4" fill="#60A5FA"/>
  </g>
</svg>`;
}

function foregroundSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
  <rect x="31" y="31" width="20" height="20" rx="4" fill="#fff"/>
  <rect x="57" y="31" width="20" height="20" rx="4" fill="#fff"/>
  <rect x="31" y="57" width="20" height="20" rx="4" fill="#fff"/>
  <rect x="57" y="57" width="20" height="20" rx="4" fill="#fff"/>
  <circle cx="54" cy="54" r="4" fill="#60A5FA"/>
</svg>`;
}

function backgroundSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
  <rect width="108" height="108" fill="#1E3A8A"/>
</svg>`;
}

async function writePNG(svgStr, size, outPath) {
  await sharp(Buffer.from(svgStr))
    .resize(size, size)
    .png()
    .toFile(outPath);
}

async function main() {
  console.log('Generating CRM Hub launcher icons…');

  for (const [folder, size] of Object.entries(SIZES)) {
    const dir = path.join(RES_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await writePNG(iconSVG(size),       size, path.join(dir, 'ic_launcher.png'));
    await writePNG(roundIconSVG(size),  size, path.join(dir, 'ic_launcher_round.png'));
    await writePNG(foregroundSVG(size),  size, path.join(dir, 'ic_launcher_foreground.png'));
    await writePNG(backgroundSVG(size),  size, path.join(dir, 'ic_launcher_background.png'));

    console.log(`  ✓ ${folder} (${size}×${size})`);
  }

  console.log('Done! All Hub CRM icons written.');
}

main().catch(err => { console.error(err); process.exit(1); });
