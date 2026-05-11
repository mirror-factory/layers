#!/usr/bin/env python3
import subprocess
import os

# The SVG source file
svg_source = "/Users/alfonso/Documents/GitHub/layers/ios-app-icon-1024.svg"
icon_dir = "/Users/alfonso/Documents/GitHub/layers/src-tauri/icons"

# Required Tauri icon sizes
icon_sizes = [
    ("icon.png", 1024),
    ("32x32.png", 32),
    ("128x128.png", 128),
    ("128x128@2x.png", 256),
    ("icon.icns", 1024)  # Will convert to ICNS
]

print("🎨 Generating Tauri/macOS app icons with proper Layers branding...")

for filename, size in icon_sizes:
    if filename.endswith('.icns'):
        # Create PNG first, then convert to ICNS
        temp_png = os.path.join(icon_dir, "temp_1024.png")

        # Generate 1024px PNG
        cmd_png = [
            "rsvg-convert",
            "-w", str(size),
            "-h", str(size),
            svg_source,
            "-o", temp_png
        ]

        subprocess.run(cmd_png, check=True)

        # Convert to ICNS
        output_path = os.path.join(icon_dir, filename)
        cmd_icns = [
            "sips",
            "-s", "format", "icns",
            temp_png,
            "--out", output_path
        ]

        subprocess.run(cmd_icns, check=True)
        os.remove(temp_png)  # Clean up temp file
        print(f"✅ Created {filename} (ICNS format)")

    else:
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

print("🎉 All Tauri/macOS icons generated with proper Layers branding!")