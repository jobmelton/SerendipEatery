const fs = require('fs')
const path = require('path')

// Generate PWA icons as SVG-based PNGs using a simple approach
// Since sharp may not be available, create SVG files that browsers can use

const sizes = [72, 192, 512]

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#0f0a1e"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.42}" fill="#F7941D"/>
  <text x="${size/2}" y="${size * 0.58}" text-anchor="middle" font-size="${size * 0.45}" font-weight="900" font-family="Arial Black, Arial, sans-serif" fill="#0f0a1e">S</text>
</svg>`

const outDir = path.join(__dirname, '..', 'public')

for (const size of sizes) {
  const filename = `icon-${size}.svg`
  fs.writeFileSync(path.join(outDir, filename), svg(size))
  console.log(`Generated ${filename}`)

  // Also create a copy as .png reference (SVGs work for PWA icons in modern browsers)
  // For true PNG generation, install sharp: npm install sharp
  // const sharp = require('sharp')
  // await sharp(Buffer.from(svg(size))).png().toFile(path.join(outDir, `icon-${size}.png`))
}

// Create a simple PNG-compatible SVG with PNG extension for maximum compatibility
for (const size of sizes) {
  const pngPath = path.join(outDir, `icon-${size}.png`)
  if (!fs.existsSync(pngPath)) {
    // Write SVG content with .png extension — most browsers handle this
    fs.writeFileSync(pngPath, svg(size))
    console.log(`Generated icon-${size}.png (SVG format)`)
  }
}

console.log('Icon generation complete!')
