from PIL import Image

img = Image.open("D:/AI/repository/Memoboard/scratch/crop.png")
w, h = img.size

# Find the first pixel that is not black (R, G, B > 10)
first_x = -1
first_y = -1

for y in range(h):
    for x in range(w):
        r, g, b = img.getpixel((x, y))[:3]
        if r > 10 or g > 10 or b > 10:
            first_x = x
            first_y = y
            break
    if first_x != -1:
        break

print(f"Visible window content starts at relative coordinate: X={first_x}, Y={first_y}")
