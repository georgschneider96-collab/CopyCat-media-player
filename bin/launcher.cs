using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

namespace CopyCatLauncher
{
    static class Program
    {
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

                string batFile = Path.Combine(appDir, "Launch_CopyCat.bat");
                string electronExe = Path.Combine(appDir, "node_modules", "electron", "dist", "electron.exe");

                string passedArgs = "";
                if (args != null && args.Length > 0)
                {
                    for (int i = 0; i < args.Length; i++)
                    {
                        string a = args[i];
                        if (a.Contains(" ") && !a.StartsWith("\""))
                            passedArgs += " \"" + a + "\"";
                        else
                            passedArgs += " " + a;
                    }
                }

                if (File.Exists(batFile))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "cmd.exe";
                    psi.Arguments = "/c \"\"" + batFile + "\"" + passedArgs + "\"";
                    psi.WorkingDirectory = appDir;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                }
                else if (File.Exists(electronExe))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = electronExe;
                    psi.Arguments = "." + passedArgs;
                    psi.WorkingDirectory = appDir;
                    psi.UseShellExecute = true;
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
