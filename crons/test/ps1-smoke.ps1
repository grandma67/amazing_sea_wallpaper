# Smoke test of amazing-sea-wallpaper.ps1 under the PowerShell running this file (CI runs it under
# Windows PowerShell 5.1 and PowerShell 7). Stubs on, a temp folder, nothing on the machine changes.
#   -Status (no network) must exit 0 and print the version;
#   -DryRun against the live site must exit 0 or 1 (1: the network, or a picture that fails the
#   check), never crash (a 5.1-only syntax or API problem shows as another code or an exception).
$ErrorActionPreference = 'Stop'
$script = Join-Path (Split-Path -Parent $PSScriptRoot) 'amazing-sea-wallpaper.ps1'
$home_ = Join-Path ([IO.Path]::GetTempPath()) ("asw-smoke-" + [guid]::NewGuid())
$env:AMAZING_SEA_WALLPAPER_HOME = $home_
$env:AMAZING_SEA_WALLPAPER_STUBS = '1'
$exe = (Get-Process -Id $PID).Path
$failed = 0
try {
    $out = & $exe -NoProfile -ExecutionPolicy Bypass -File $script -Status 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $out -notmatch 'amazing-sea-wallpaper \d+\.\d+\.\d+') { Write-Output "FAIL -Status ($LASTEXITCODE):`n$out"; $failed++ }
    else { Write-Output 'ok   -Status' }
    $out = & $exe -NoProfile -ExecutionPolicy Bypass -File $script -DryRun 2>&1 | Out-String
    if ($LASTEXITCODE -notin 0, 1 -or $out -notmatch 'would set|nothing to set') { Write-Output "FAIL -DryRun ($LASTEXITCODE):`n$out"; $failed++ }
    else { Write-Output "ok   -DryRun (exit $LASTEXITCODE): $($out.Trim() -replace '\r?\n', ' | ')" }
} finally {
    Remove-Item -LiteralPath $home_ -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Output ("PowerShell {0}: {1} failed" -f $PSVersionTable.PSVersion, $failed)
exit $failed
