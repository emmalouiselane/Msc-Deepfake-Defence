"""
Create simple placeholder icons for the Chrome extension
"""

import os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

def create_icon(size, output_path):
    """Create a simple icon with detection theme"""
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Colors
    bg_color = (148, 4, 139)  #94048b - primary color
    text_color = (255, 255, 255)  # white
    
    if size >= 48:
        # Larger icons - more detail
        # Background circle
        margin = size // 8
        draw.ellipse([margin, margin, size - margin, size - margin], 
                   fill=bg_color)
        
        # Magnifying glass icon
        glass_size = size // 2
        glass_x = size // 2 - glass_size // 2
        glass_y = size // 2 - glass_size // 2
        draw.ellipse([glass_x, glass_y, glass_x + glass_size, glass_y + glass_size], 
                   outline=text_color, width=max(1, size // 32))
        
        # Handle
        handle_x = glass_x + glass_size - size // 16
        handle_y = glass_y + glass_size - size // 16
        draw.line([handle_x, handle_y, handle_x + size // 8, handle_y + size // 8], 
                 fill=text_color, width=max(1, size // 32))
        
    elif size >= 32:
        # Medium icons - simplified
        margin = size // 6
        draw.ellipse([margin, margin, size - margin, size - margin], 
                   fill=bg_color)
        
        # Simple magnifying glass
        center = size // 2
        radius = size // 4
        draw.ellipse([center - radius, center - radius, center + radius, center + radius], 
                   outline=text_color, width=max(1, size // 24))
        
        # Handle
        handle_start = center + radius - size // 20
        draw.line([handle_start, handle_start, 
                 center + radius + size // 12, center + radius + size // 12], 
                 fill=text_color, width=max(1, size // 24))
        
    else:
        # Small icons - very simplified
        margin = size // 4
        draw.ellipse([margin, margin, size - margin, size - margin], 
                   fill=bg_color)
        
        # Just a circle with small indicator
        center = size // 2
        dot_size = max(1, size // 8)
        draw.ellipse([center - dot_size//2, center - dot_size//2, 
                   center + dot_size//2, center + dot_size//2], 
                   fill=text_color)
    
    # Save the image
    img.save(output_path, 'PNG')
    print(f"Created {output_path} ({size}x{size})")

def main():
    """Create all required icon sizes"""
    icon_dir = "extension/icons"
    os.makedirs(icon_dir, exist_ok=True)
    
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        output_path = os.path.join(icon_dir, f"icon{size}.png")
        create_icon(size, output_path)
    
    print(f"\nAll icons created in {icon_dir}/")
    print("You can now load the extension in Chrome!")

if __name__ == "__main__":
    main()
