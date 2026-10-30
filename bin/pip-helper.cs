using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class PipHelper
{
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TOPMOST = 0x00000008;
    private const int SW_RESTORE = 9;
    private const uint MONITOR_DEFAULTTONEAREST = 2;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);

    [DllImport("user32.dll")]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int X,
        int Y,
        int cx,
        int cy,
        uint uFlags
    );

    public static int Main(string[] args)
    {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
        catch { try { SetProcessDPIAware(); } catch { } }

        if (args.Length >= 2 && args[0] == "--restore")
        {
            ulong hwndRestore;
            if (ulong.TryParse(args[1], out hwndRestore) && hwndRestore != 0)
            {
                IntPtr h = new IntPtr((long)hwndRestore);
                if (IsIconic(h)) ShowWindow(h, SW_RESTORE);
                SetForegroundWindow(h);
                Console.WriteLine("RESTORED");
                return 0;
            }
            return 1;
        }

        if (args.Length >= 2 && args[0] == "--list")
        {
            uint listPid;
            uint.TryParse(args[1], out listPid);
            EnumWindows((hWnd, lParam) =>
            {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (listPid != 0 && pid != listPid) return true;
                StringBuilder cls = new StringBuilder(64);
                GetClassName(hWnd, cls, cls.Capacity);
                if (!cls.ToString().StartsWith("Chrome_WidgetWin_", StringComparison.Ordinal)) return true;
                StringBuilder title = new StringBuilder(128);
                GetWindowText(hWnd, title, title.Capacity);
                RECT r;
                GetWindowRect(hWnd, out r);
                int ex = GetWindowLong(hWnd, GWL_EXSTYLE);
                Console.WriteLine(string.Format(
                    CultureInfo.InvariantCulture,
                    "HWND={0} PID={1} VIS={2} EX=0x{3:X} RECT={4},{5} {6}x{7} TITLE={8}",
                    (ulong)hWnd.ToInt64(), pid, IsWindowVisible(hWnd), ex,
                    r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top, title.ToString()
                ));
                return true;
            }, IntPtr.Zero);
            return 0;
        }

        if (args.Length < 2)
        {
            Console.WriteLine("ERR_ARGS");
            return 1;
        }

        uint targetPid;
        ulong mainHwndVal;
        if (!uint.TryParse(args[0], out targetPid) || !ulong.TryParse(args[1], out mainHwndVal))
        {
            Console.WriteLine("ERR_PARSE");
            return 1;
        }

        double aspect = 16.0 / 9.0;
        if (args.Length >= 3)
        {
            double parsedAspect;
            if (double.TryParse(args[2], NumberStyles.Float, CultureInfo.InvariantCulture, out parsedAspect) && parsedAspect > 0.1 && parsedAspect < 10.0)
            {
                aspect = parsedAspect;
            }
        }

        double widthFraction = 0.28;
        if (args.Length >= 4)
        {
            double parsedFrac;
            if (double.TryParse(args[3], NumberStyles.Float, CultureInfo.InvariantCulture, out parsedFrac) && parsedFrac >= 0.15 && parsedFrac <= 0.65)
            {
                widthFraction = parsedFrac;
            }
        }

        IntPtr foundPip = IntPtr.Zero;
        RECT pipRect = new RECT();

        for (int attempt = 0; attempt < 25; attempt++)
        {
            EnumWindows((hWnd, lParam) =>
            {
                if ((ulong)hWnd.ToInt64() == mainHwndVal) return true;
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (pid != targetPid) return true;
                if (!IsWindowVisible(hWnd)) return true;

                StringBuilder sb = new StringBuilder(64);
                GetClassName(hWnd, sb, sb.Capacity);
                string cls = sb.ToString();
                if (!cls.StartsWith("Chrome_WidgetWin_", StringComparison.Ordinal)) return true;

                RECT r;
                if (!GetWindowRect(hWnd, out r)) return true;
                int w = r.Right - r.Left;
                int h = r.Bottom - r.Top;
                if (w < 60 || h < 60) return true;

                int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
                if ((exStyle & WS_EX_TOPMOST) == 0) return true;

                foundPip = hWnd;
                pipRect = r;
                return false;
            }, IntPtr.Zero);

            if (foundPip != IntPtr.Zero) break;
            Thread.Sleep(15);
        }

        if (foundPip == IntPtr.Zero)
        {
            Console.WriteLine("ERR_NOT_FOUND");
            return 2;
        }

        IntPtr hMon = MonitorFromWindow(foundPip, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = new MONITORINFO();
        mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(hMon, ref mi))
        {
            Console.WriteLine("ERR_MONITOR");
            return 3;
        }

        RECT work = mi.rcWork;
        int workW = Math.Max(640, work.Right - work.Left);
        int workH = Math.Max(480, work.Bottom - work.Top);

        int targetW;
        int targetH;
        if (aspect >= 1.0)
        {
            targetW = (int)Math.Round(workW * widthFraction);
            targetH = (int)Math.Round(targetW / aspect);
            int maxH = (int)Math.Round(workH * 0.45);
            if (targetH > maxH)
            {
                targetH = maxH;
                targetW = (int)Math.Round(targetH * aspect);
            }
        }
        else
        {
            targetH = (int)Math.Round(workH * 0.42);
            targetW = (int)Math.Round(targetH * aspect);
        }

        int pipCenterX = (pipRect.Left + pipRect.Right) / 2;
        int pipCenterY = (pipRect.Top + pipRect.Bottom) / 2;
        int workCenterX = (work.Left + work.Right) / 2;
        int workCenterY = (work.Top + work.Bottom) / 2;

        int newX = (pipCenterX >= workCenterX) ? (pipRect.Right - targetW) : pipRect.Left;
        int newY = (pipCenterY >= workCenterY) ? (pipRect.Bottom - targetH) : pipRect.Top;

        int margin = 16;
        if (newX < work.Left + margin) newX = work.Left + margin;
        if (newX + targetW > work.Right - margin) newX = work.Right - margin - targetW;
        if (newY < work.Top + margin) newY = work.Top + margin;
        if (newY + targetH > work.Bottom - margin) newY = work.Bottom - margin - targetH;

        SetWindowPos(foundPip, HWND_TOPMOST, newX, newY, targetW, targetH, SWP_NOACTIVATE | SWP_SHOWWINDOW);
        Console.WriteLine(string.Format(CultureInfo.InvariantCulture, "OK {0},{1},{2},{3}", newX, newY, targetW, targetH));
        return 0;
    }
}
