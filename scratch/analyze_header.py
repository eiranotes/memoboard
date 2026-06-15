from PIL import Image

img = Image.open("D:/AI/repository/Memoboard/scratch/crop.png")
# Crop header region (height is usually around 100 pixels in high DPI)
header = img.crop((0, 0, img.width, 100))
header.save("D:/AI/repository/Memoboard/scratch/header.png")
print("Header saved. Size:", header.size)
