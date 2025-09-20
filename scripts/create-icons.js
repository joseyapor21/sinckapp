// Simple script to create placeholder icons
// In production, you would use proper icon files

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'assets');

// Create a simple SVG icon
const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" fill="#2c3e50"/>
  <circle cx="128" cy="128" r="80" fill="#3498db"/>
  <text x="128" y="140" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="white">SC</text>
  <text x="128" y="200" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#ecf0f1">SinckApp</text>
</svg>`;

// Write SVG file
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon);

console.log('Created placeholder icon at assets/icon.svg');
console.log('Note: For production, replace with proper .icns, .ico, and .png files');
console.log('You can use online tools to convert SVG to these formats:');
console.log('- .icns for macOS');
console.log('- .ico for Windows'); 
console.log('- .png for Linux');