import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

// Generate a rounded-rect app icon with a green background and white apple emoji-style shape
async function createAppIcon(size) {
  const padding = Math.round(size * 0.15);
  const inner = size - padding * 2;
  const radius = Math.round(size * 0.2);

  // Green background with rounded corners and a white leaf/apple shape
  const svg = `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#16a34a"/>
    <g transform="translate(${size / 2}, ${size / 2})">
      <!-- Apple body -->
      <ellipse cx="0" cy="${inner * 0.05}" rx="${inner * 0.3}" ry="${inner * 0.33}" fill="white"/>
      <!-- Leaf -->
      <path d="M 0 ${-inner * 0.28} Q ${inner * 0.15} ${-inner * 0.45} ${inner * 0.05} ${-inner * 0.18}"
            stroke="white" stroke-width="${Math.max(2, size * 0.03)}" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `icon-${size}x${size}.png`));

  console.log(`Created icon-${size}x${size}.png`);
}

// Generate a small badge icon (monochrome, simpler)
async function createBadgeIcon(size) {
  const svg = `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#16a34a"/>
    <g transform="translate(${size / 2}, ${size / 2})">
      <ellipse cx="0" cy="${size * 0.03}" rx="${size * 0.25}" ry="${size * 0.28}" fill="white"/>
      <path d="M 0 ${-size * 0.22} Q ${size * 0.12} ${-size * 0.38} ${size * 0.04} ${-size * 0.14}"
            stroke="white" stroke-width="${Math.max(1.5, size * 0.04)}" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `badge-${size}x${size}.png`));

  console.log(`Created badge-${size}x${size}.png`);
}

// Generate a simple action icon
async function createActionIcon(name, pathD, size = 24) {
  const svg = `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <path d="${pathD}" stroke="#16a34a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `${name}.png`));

  console.log(`Created ${name}.png`);
}

// Generate all icons
const appSizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of appSizes) {
  await createAppIcon(size);
}

await createBadgeIcon(72);

// View icon (eye shape)
await createActionIcon('view-icon',
  'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z');

// Close icon (X shape)
await createActionIcon('close-icon',
  'M6 6L18 18M6 18L18 6');

console.log('\nAll icons generated successfully!');
