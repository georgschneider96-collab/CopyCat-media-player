using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace CopyCatLauncher
{
    static class Program
    {
        [DllImport("user32.dll")]
        static extern IntPtr GetThreadDesktop(int dwThreadId);

        [DllImport("kernel32.dll")]
        static extern int GetCurrentThreadId();

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool GetUserObjectInformation(IntPtr hObj, int nIndex, StringBuilder pvInfo, int nLength, out int lpnLengthNeeded);

        static string GetCurrentDesktopName()
        {
            try
            {
                IntPtr hDesk = GetThreadDesktop(GetCurrentThreadId());
                if (hDesk == IntPtr.Zero) return "";
                StringBuilder sb = new StringBuilder(256);
                int needed = 0;
                if (GetUserObjectInformation(hDesk, 2, sb, 256, out needed))
                {
                    return sb.ToString();
                }
            }
            catch {}
            return "";
        }

        static bool IsPlayerResponsive()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:4500/api/status");
                req.Method = "GET";
                req.Timeout = 800;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        static bool SendHttpControl(string action, string filePath = null)
        {
            try
            {
                string json = "{\"action\":\"" + action + "\"";
                if (!string.IsNullOrEmpty(filePath))
                {
                    string cleanPath = filePath.Replace("\\", "\\\\").Replace("\"", "\\\"");
                    json += ",\"filePath\":\"" + cleanPath + "\"";
                }
                json += "}";

                byte[] data = Encoding.UTF8.GetBytes(json);
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:4500/api/control");
                req.Method = "POST";
                req.ContentType = "application/json";
                req.ContentLength = data.Length;
                req.Timeout = 1500;
                using (Stream s = req.GetRequestStream())
                {
                    s.Write(data, 0, data.Length);
                }
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        static void EnsureScheduledTaskRegistered(string appDir)
        {
            try
            {
                string exePath = Path.Combine(appDir, "Launch_CopyCat.exe");
                ProcessStartInfo checkPsi = new ProcessStartInfo("schtasks.exe", "/query /tn \"LaunchCopyCat\"");
                checkPsi.WindowStyle = ProcessWindowStyle.Hidden;
                checkPsi.CreateNoWindow = true;
                checkPsi.UseShellExecute = false;
                Process pCheck = Process.Start(checkPsi);
                pCheck.WaitForExit(1000);
                if (pCheck.ExitCode != 0)
                {
                    string createArgs = string.Format("/create /tn \"LaunchCopyCat\" /tr \"\\\"{0}\\\"\" /sc once /st 23:59 /f", exePath);
                    ProcessStartInfo createPsi = new ProcessStartInfo("schtasks.exe", createArgs);
                    createPsi.WindowStyle = ProcessWindowStyle.Hidden;
                    createPsi.CreateNoWindow = true;
                    createPsi.UseShellExecute = false;
                    Process pCreate = Process.Start(createPsi);
                    pCreate.WaitForExit(2000);
                }
            }
            catch {}
        }

        static void LaunchViaTaskScheduler(string appDir)
        {
            EnsureScheduledTaskRegistered(appDir);
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("schtasks.exe", "/run /tn \"LaunchCopyCat\"");
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                Process p = Process.Start(psi);
                p.WaitForExit(2000);
            }
            catch {}
        }

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string appDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                if (!string.IsNullOrEmpty(appDir))
                {
                    Directory.SetCurrentDirectory(appDir);
                }

                string passedFilePath = "";
                string passedArgs = "";
                if (args != null && args.Length > 0)
                {
                    for (int i = 0; i < args.Length; i++)
                    {
                        string a = args[i].Trim('\"');
                        if (File.Exists(a) && string.IsNullOrEmpty(passedFilePath))
                        {
                            passedFilePath = Path.GetFullPath(a);
                        }

                        if (a.Contains(" ") && !a.StartsWith("\""))
                            passedArgs += " \"" + a + "\"";
                        else
                            passedArgs += " " + a;
                    }
                }

                // 1. If already running, send control command and bring to front
                if (IsPlayerResponsive())
                {
                    if (!string.IsNullOrEmpty(passedFilePath))
                    {
                        SendHttpControl("openFile", passedFilePath);
                    }
                    SendHttpControl("bringToFront");
                    return;
                }

                string desk = GetCurrentDesktopName();
                bool isDefaultDesktop = desk.Equals("Default", StringComparison.OrdinalIgnoreCase);

                // 2. If running in background sandbox/runner desktop (exebox-...), delegate to Task Scheduler for WinSta0\Default
                if (!isDefaultDesktop && !string.IsNullOrEmpty(desk))
                {
                    LaunchViaTaskScheduler(appDir);

                    // Wait briefly for server to spin up on Default desktop
                    for (int w = 0; w < 12; w++)
                    {
                        Thread.Sleep(350);
                        if (IsPlayerResponsive())
                        {
                            if (!string.IsNullOrEmpty(passedFilePath))
                            {
                                SendHttpControl("openFile", passedFilePath);
                            }
                            SendHttpControl("bringToFront");
                            return;
                        }
                    }
                    return;
                }

                // 3. Direct launch on Default desktop
                string electronExe = Path.Combine(appDir, "node_modules", "electron", "dist", "electron.exe");
                if (File.Exists(electronExe))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = electronExe;
                    psi.Arguments = string.IsNullOrEmpty(passedArgs) ? "." : ". " + passedArgs.TrimStart();
                    psi.WorkingDirectory = appDir;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }
                else
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "cmd.exe";
                    psi.Arguments = "/c npm start";
                    psi.WorkingDirectory = appDir;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                }
            }
            catch (Exception ex)
            {
                System.Windows.Forms.MessageBox.Show(
                    "Failed to launch CopyCat media player:\n" + ex.Message,
                    "CopyCat media player",
                    System.Windows.Forms.MessageBoxButtons.OK,
                    System.Windows.Forms.MessageBoxIcon.Error
                );
            }
        }
    }
}
