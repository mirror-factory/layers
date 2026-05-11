#!/usr/bin/env python3
import subprocess
import os

# The correct SVG source file with Layers concentric arcs design
svg_source = "/Users/alfonso/Documents/GitHub/layers/branding/source/layers-icon-1024.svg"
icon_dir = "/Users/alfonso/Documents/GitHub/layers/ios/App/App/Assets.xcassets/AppIcon.appiconset"

# iOS app icon sizes
icon_sizes = [
    ("icon-20.png", 20),
    ("icon-29.png", 29),
    ("icon-40.png", 40),
    ("icon-58.png", 58),
    ("icon-60.png", 60),
    ("icon-76.png", 76),
    ("icon-80.png", 80),
    ("icon-87.png", 87),
    ("icon-120.png", 120),
    ("icon-152.png", 152),
    ("icon-167.png", 167),
    ("icon-180.png", 180),
    ("icon-1024.png", 1024),
]

print("🎨 Generating iOS app icons with proper Layers concentric arcs branding...")

for filename, size in icon_sizes:
    output_path = os.path.join(icon_dir, filename)

    cmd = [
        "rsvg-convert",
        "-w", str(size),
        "-h", str(size),
        svg_source,
        "-o", output_path
    ]

    subprocess.run(cmd, check=True)
    print(f"✅ Created {filename} ({size}×{size})")

print("🎉 All iOS icons generated with proper Layers concentric arcs branding!")
