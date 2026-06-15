import ctypes
import time
import sys
from PIL import ImageGrab

if len(sys.argv) < 2:
    print("Usage: python click_guide.py <HWND>")
    sys.exit(1)

hwnd = int(sys.argv[1])

# Set DPI awareness (Per Monitor v2)
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

user32 = ctypes.windll.user32

if hwnd:
    print(f"Using Memoboard HWND from args: {hwnd}")
    
    # SW_RESTORE = 9 restores the window if it was maximized/minimized
    user32.ShowWindow(hwnd, 9)
    time.sleep(0.5)
    
    # Set topmost and position at (100, 100) with size 1280x820
    # HWND_TOPMOST = -1, SWP_SHOWWINDOW = 0x0040
    user32.SetWindowPos(hwnd, -1, 100, 100, 1280, 820, 0x0040)
    time.sleep(1.0)
    
    # Click at X = 100 + 415 = 515, Y = 100 + 25 = 125 (the Guide tab)
    user32.SetCursorPos(515, 125)
    time.sleep(0.2)
    user32.mouse_event(0x0002, 0, 0, 0, 0) # Left down
    time.sleep(0.05)
    user32.mouse_event(0x0004, 0, 0, 0, 0) # Left up
    time.sleep(1.5)
    
    # Release topmost
    user32.SetWindowPos(hwnd, -2, 100, 100, 1280, 820, 0)
    time.sleep(0.5)
else:
    print("Invalid HWND.")
    sys.exit(1)

# Capture virtual screen
# Left=-1920, Top=0, Width=4480, Height=1769 -> Right = 2560
bbox = (-1920, 0, 2560, 1769)
img = ImageGrab.grab(bbox=bbox, all_screens=True)
img.save("D:/AI/repository/Memoboard/scratch/screenshot.png")
print("Screenshot saved to D:/AI/repository/Memoboard/scratch/screenshot.png")

# Crop window to verify
crop_area = (100 - (-1920), 100, 100 - (-1920) + 1280, 100 + 820)
cropped = img.crop(crop_area)
cropped.save("D:/AI/repository/Memoboard/scratch/crop.png")
print("Cropped window saved to D:/AI/repository/Memoboard/scratch/crop.png")
