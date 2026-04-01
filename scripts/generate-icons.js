/**
 * Generates all PWA icon sizes from an inline SVG recreation of the
 * neon blue snowflake.  Run once with: node scripts/generate-icons.js
 *
 * Outputs to /public:
 *   icon-1024.png  (source master)
 *   icon-512.png
 *   icon-192.png
 *   apple-touch-icon.png  (180×180 – what iOS actually reads)
 *   favicon.png           (32×32)
 */

const sharp = require('../node_modules/sharp')
const path  = require('path')
const fs    = require('fs')

const OUT = path.join(__dirname, '..', 'public')

// ─── SVG Source ──────────────────────────────────────────────────────────────
//
// One "arm" is defined pointing straight up from (0,0), then rotated 6×60°.
// Geometry (centre-relative, Y = down in SVG space, so "up" = negative Y):
//
//   Main shaft      : (0,0) → (0,−350)
//   Outer fork @ −255: (0,−255) → (±58, −305)   — branches diverge at ~45°
//   Mid   fork @ −160: (0,−160) → (±55, −208)   — same spread angle
//   Inner fork @ −90 : (0,−90)  → (±45, −128)   — smaller inner branches
//
// Three layers produce the neon tube look:
//   1. Wide outer glow  – blurred, dark blue   (#0044BB, stdDev 22, sw 28)
//   2. Mid glow         – blurred, bright blue (#0088FF, stdDev 10, sw 18)
//   3. Hot core         – sharp, near-white    (#AADDFF, sw  8)

const ARM_SEGS = [
  // main shaft
  'M 512 512 L 512 162',
  // outer fork at y=257 (255px up from 512)
  'M 512 257 L 454 207',
  'M 512 257 L 570 207',
  // mid fork at y=352
  'M 512 352 L 457 304',
  'M 512 352 L 567 304',
  // inner fork at y=422
  'M 512 422 L 467 384',
  'M 512 422 L 557 384',
]

function makeArm(rotDeg) {
  const rot = `rotate(${rotDeg} 512 512)`
  return ARM_SEGS.map(d => `<path d="${d}" transform="${rot}"/>`).join('\n    ')
}

const angles = [0, 60, 120, 180, 240, 300]

function snowflakePaths(strokeColor, strokeWidth, extra = '') {
  return `<g stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none" ${extra}>
    ${angles.map(makeArm).join('\n    ')}
  </g>`
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- outer glow blur -->
    <filter id="b22" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="22"/>
    </filter>
    <!-- mid glow blur -->
    <filter id="b10" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <!-- soft inner halo -->
    <filter id="b4" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="#0B0F1A"/>

  <!-- Layer 1 – outer atmospheric glow (dark blue, very blurred) -->
  <g filter="url(#b22)" opacity="0.75">
    ${snowflakePaths('#0055CC', 32)}
  </g>

  <!-- Layer 2 – mid glow (electric blue, medium blur) -->
  <g filter="url(#b10)" opacity="0.85">
    ${snowflakePaths('#0088FF', 20)}
  </g>

  <!-- Layer 3 – inner soft bloom -->
  <g filter="url(#b4)" opacity="0.9">
    ${snowflakePaths('#44BBFF', 14)}
  </g>

  <!-- Layer 4 – hot core (near-white centre line, sharp) -->
  ${snowflakePaths('#DDEEFF', 7)}
</svg>`

// ─── Render ───────────────────────────────────────────────────────────────────

async function render(svgBuffer, size, filename) {
  const outPath = path.join(OUT, filename)
  await sharp(svgBuffer)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log(`✓  ${filename}  (${size}×${size})`)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const buf = Buffer.from(SVG)

  await render(buf, 1024, 'icon-1024.png')
  await render(buf, 512,  'icon-512.png')
  await render(buf, 192,  'icon-192.png')
  await render(buf, 180,  'apple-touch-icon.png')
  await render(buf, 32,   'favicon.png')

  console.log('\nAll icons written to /public ✓')
}

main().catch(err => { console.error(err); process.exit(1) })
