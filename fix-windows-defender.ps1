# Run this script as Administrator to fix EPERM errors in Next.js on Windows
# Right-click on PowerShell → "Run as administrator" then paste this command:
# powershell -ExecutionPolicy Bypass -File "G:\Github\CMRU_Dormitory_System\fix-windows-defender.ps1"

$paths = @(
    "G:\Github\CMRU_Dormitory_System",
    "G:\Github\CMRU_Dormitory_System\.next"
)

foreach ($path in $paths) {
    Add-MpPreference -ExclusionPath $path
    Write-Host "✅ Added exclusion: $path"
}

Write-Host ""
Write-Host "✅ Done! Now restart 'bun run dev' to apply changes."
