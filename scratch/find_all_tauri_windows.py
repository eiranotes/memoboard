import ctypes

# Set DPI awareness
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

user32 = ctypes.windll.user32

class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_int),
                ("top", ctypes.c_int),
                ("right", ctypes.c_int),
                ("bottom", ctypes.c_int)]

def enum_win_callback(h, l):
    if not user32.IsWindowVisible(h):
        return True
    
    # Get PID
    pid = ctypes.c_ulong()
    user32.GetWindowThreadProcessId(h, ctypes.byref(pid))
    
    # Get process name or check if pid is Memoboard-1.0.1 (PID 34480)
    # Let's target PID 34480 since we know it is Memoboard-1.0.1
    if pid.value != 34480:
        return True
        
    length = user32.GetWindowTextLengthW(h)
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(h, buf, length + 1)
    title = buf.value
    
    class_buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(h, class_buf, 256)
    cls = class_buf.value
    
    # Get window rect
    rect = RECT()
    user32.GetWindowRect(h, ctypes.byref(rect))
    w = rect.right - rect.left
    h_dim = rect.bottom - rect.top
    
    print(f"HWND: {h}, PID: {pid.value}, Title: '{title}', Class: '{cls}', Rect: ({rect.left}, {rect.top}, {rect.right}, {rect.bottom}), Size: {w}x{h_dim}")
    return True

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
user32.EnumWindows(WNDENUMPROC(enum_win_callback), 0)
