from PIL import Image

img = Image.open("D:/AI/repository/Memoboard/scratch/crop.png")
w, h = img.size

green_pixels = []
for y in range(h):
    for x in range(w):
        r, g, b = img.getpixel((x, y))[:3]
        # Look for green logo color (e.g. R ~ 46, G ~ 125, B ~ 50)
        # We can use a threshold: g > 1.5 * r and g > 1.5 * b and g > 80
        if g > 1.5 * r and g > 1.5 * b and g > 80:
            green_pixels.append((x, y))

if green_pixels:
    # Get the bounding box of the green logo
    min_x = min(p[0] for p in green_pixels)
    max_x = max(p[0] for p in green_pixels)
    min_y = min(p[1] for p in green_pixels)
    max_y = max(p[1] for p in green_pixels)
    print(f"Green icon found at: X={min_x}..{max_x}, Y={min_y}..{max_y} (Center: {(min_x + max_x)//2}, {(min_y + max_y)//2})")
else:
    print("Green icon not found.")
