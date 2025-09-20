#!/bin/bash

# Create icon.iconset directory
mkdir -p assets/icon.iconset

# Create a simple colored square icon using Python (if available) or ImageMagick
# This is a fallback - ideally you'd use a proper design tool

# Check if we have sips (macOS image tool)
if command -v sips &> /dev/null; then
    echo "Creating placeholder icons using sips..."
    
    # Create a base 1024x1024 image from SVG
    if command -v rsvg-convert &> /dev/null; then
        rsvg-convert -w 1024 -h 1024 assets/icon.svg -o assets/icon-1024.png
    else
        # Create a simple colored rectangle as fallback
        echo "Creating simple placeholder icon..."
        # Use Python to create a simple icon
        python3 << EOF
from PIL import Image, ImageDraw, ImageFont
import os

# Create a 1024x1024 image
img = Image.new('RGB', (1024, 1024), color='#2c3e50')
draw = ImageDraw.Draw(img)

# Draw a circle
circle_margin = 100
draw.ellipse([circle_margin, circle_margin, 1024-circle_margin, 1024-circle_margin], fill='#3498db')

# Try to add text
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 200)
except:
    font = ImageFont.load_default()

# Draw text
text = "SC"
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
x = (1024 - text_width) // 2
y = (1024 - text_height) // 2 - 50

draw.text((x, y), text, fill='white', font=font)

# Save the base image
img.save('assets/icon-1024.png')
print("Base icon created")
EOF
    fi
    
    # Generate all required icon sizes
    sizes=(16 32 64 128 256 512 1024)
    for size in "${sizes[@]}"; do
        sips -z $size $size assets/icon-1024.png --out assets/icon.iconset/icon_${size}x${size}.png
        if [ $size -ge 32 ]; then
            sips -z $((size*2)) $((size*2)) assets/icon-1024.png --out assets/icon.iconset/icon_${size}x${size}@2x.png
        fi
    done
    
    # Create the .icns file
    iconutil -c icns assets/icon.iconset -o assets/icon.icns
    
    echo "Icon files created successfully!"
    echo "- assets/icon.icns (for macOS)"
    echo "- assets/icon.iconset/ (source files)"
    
else
    echo "sips not available. Creating minimal icon files..."
    # Just copy the SVG as a fallback
    cp assets/icon.svg assets/icon.icns
fi