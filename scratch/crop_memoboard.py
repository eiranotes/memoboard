from PIL import Image

# Open screenshot
img = Image.open("D:/AI/repository/Memoboard/scratch/screenshot.png")

# Crop coordinates in the virtual screen
# Virtual Left = -1920, so primary X=0 is 1920.
# Window is at Left=100, Top=100, Width=1280, Height=820.
# So Left in image = 1920 + 100 = 2020.
# Top in image = 100.
# Right in image = 2020 + 1280 = 3300.
# Bottom in image = 100 + 820 = 920.

crop_area = (2020, 100, 3300, 920)
cropped_img = img.crop(crop_area)
cropped_img.save("D:/AI/repository/Memoboard/scratch/crop.png")
print("Cropped image size:", cropped_img.size)
