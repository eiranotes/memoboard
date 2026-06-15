import ctypes
import time
import sys
from PIL import ImageGrab

if len(sys.argv) < 2:
    print("Usage: python click_relative.py <HWND>")
    sys.exit(1)

hwnd = int(sys.argv[1])

# Operating in default logical coordinates to ensure system-wide scaling consistency

user32 = ctypes.windll.user32

class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_int),
                ("top", ctypes.c_int),
                ("right", ctypes.c_int),
                ("bottom", ctypes.c_int)]

class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_int),
                ("y", ctypes.c_int)]

if hwnd:
    print(f"Using Memoboard HWND: {hwnd}")
    
    # Restore window
    user32.ShowWindow(hwnd, 9)
    time.sleep(0.5)
    
    # Focus window
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.5)
    
    # Get window rect
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    print(f"Current Window Rect: Left={rect.left}, Top={rect.top}, Right={rect.right}, Bottom={rect.bottom}")
    
    # Calculate click position (X = Left + 496, Y = Top + 50)
    click_x = rect.left + 496
    click_y = rect.top + 50
    print(f"Target physical coordinates: X={click_x}, Y={click_y}")
    
    # Set cursor position
    res = user32.SetCursorPos(click_x, click_y)
    print(f"SetCursorPos returned: {res}")
    
    # Get cursor position to verify
    pt = POINT()
    user32.GetCursorPos(ctypes.byref(pt))
    print(f"Actual cursor position after SetCursorPos: X={pt.x}, Y={pt.y}")
    
    # Click
    time.sleep(0.2)
    user32.mouse_event(0x0002, 0, 0, 0, 0) # Left down
    time.sleep(0.05)
    user32.mouse_event(0x0004, 0, 0, 0, 0) # Left up
    time.sleep(2.0)
    
    # Get window rect again
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    left, top, right, bottom = rect.left, rect.top, rect.right, rect.bottom
    print(f"Final Window Rect: Left={left}, Top={top}, Right={right}, Bottom={bottom}")
    
else:
    print("Invalid HWND.")
    sys.exit(1)

# Capture virtual screen
bbox = (-1920, 0, 2560, 1769)
img = ImageGrab.grab(bbox=bbox, all_screens=True)
img.save("D:/AI/repository/Memoboard/scratch/screenshot.png")
print("Screenshot saved to D:/AI/repository/Memoboard/scratch/screenshot.png")

# Crop window dynamically
crop_area = (left + 1920, top, right + 1920, bottom)
cropped = img.crop(crop_area)
cropped.save("D:/AI/repository/Memoboard/scratch/crop.png")
print(f"Cropped window saved to D:/AI/repository/Memoboard/scratch/crop.png (Size: {cropped.size})")
