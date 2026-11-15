# amazing-sea-wallpaper version: 1.0.0
<#
.SYNOPSIS
  Sets the day's Amazing Sea Wallpaper (https://grandma67.github.io/amazing_sea_wallpaper/) as the
  desktop background every morning, on Windows 10/11. Plan: knowledge/plans/CRON.md in the repo.

.DESCRIPTION
  amazing-sea-wallpaper.ps1 -Install [-Portrait] [-Hour H] [-Url U] [-ShowWindow]
  amazing-sea-wallpaper.ps1 -Now | -DryRun | -Status | -Upgrade | -Uninstall [-Yes]
  amazing-sea-wallpaper.ps1            the daily run (what the scheduled task starts)
  amazing-sea-wallpaper.ps1 -Retry     the one re-run of the day

  Exit codes: 0 done or nothing to do; 1 network, HTTP or bad image; 3 no desktop session;
  4 blocked (policy, Constrained Language Mode) or missing.

  Everything it owns lives in %LOCALAPPDATA%\amazing-sea-wallpaper, plus the Task Scheduler folder
  \amazing-sea-wallpaper\. Runs on Windows PowerShell 5.1 and PowerShell 7.

  Test hooks (crons/test/run.sh), off unless set: AMAZING_SEA_WALLPAPER_HOME, _TODAY, _NOW_EPOCH,
  _STUBS=1, _RANDOM, _STUB_NOSESSION.
#>
# Helpers run inside one script, so ShouldProcess on them, and the analyzer's view of switches
# read from script scope, don't apply.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseShouldProcessForStateChangingFunctions', '')]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSReviewUnusedParameter', '')]
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Upgrade,
    [switch]$Now,
    [switch]$DryRun,
    [switch]$Retry,
    [switch]$Login,
    [switch]$Portrait,
    [ValidateRange(-1, 23)][int]$Hour = -1,
    [string]$Url = '',
    [string]$From = '',
    [switch]$Yes,
    [switch]$ShowWindow
)

$Version = '1.0.0'
$Name = 'amazing-sea-wallpaper'
$DefaultUrl = 'https://grandma67.github.io/amazing_sea_wallpaper/'
$UpgradeUrl = 'https://raw.githubusercontent.com/grandma67/amazing_sea_wallpaper/main/crons/amazing-sea-wallpaper.ps1'
$UA = "$Name/$Version"
$TaskPath = "\$Name\"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Stubs = ($env:AMAZING_SEA_WALLPAPER_STUBS -eq '1')
$OnWindows = ($PSVersionTable.PSVersion.Major -le 5) -or $IsWindows

if ($env:AMAZING_SEA_WALLPAPER_HOME) { $Dir = $env:AMAZING_SEA_WALLPAPER_HOME }
elseif ($env:LOCALAPPDATA) { $Dir = Join-Path $env:LOCALAPPDATA $Name }
else { $Dir = Join-Path $HOME ".$Name" }
$Copy = Join-Path $Dir "$Name.ps1"
$ConfigFile = Join-Path $Dir 'config'
$StateFile = Join-Path $Dir 'state'
$LogFile = Join-Path $Dir "$Name.log"
$Wall = Join-Path $Dir 'wallpapers'
$Lock = Join-Path $Dir 'lock'

if ($Install) { $Mode = 'install' } elseif ($Uninstall) { $Mode = 'uninstall' } elseif ($Status) { $Mode = 'status' }
elseif ($Upgrade) { $Mode = 'upgrade' } elseif ($Now) { $Mode = 'now' } elseif ($DryRun) { $Mode = 'dry-run' }
elseif ($Retry) { $Mode = 'retry' } elseif ($Login) { $Mode = 'login' } else { $Mode = 'schedule' }

# ---------- helpers ----------

function Write-AswLog([string]$Message) {
    $line = '{0} {1}: {2}' -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $Mode, $Message
    Write-Output $line
    if (Test-Path -LiteralPath $Dir) {
        try { Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8 } catch { Write-Verbose "log: $_" }
    }
}
function Stop-Run([int]$Code, [string]$Message) { Write-AswLog "error: $Message"; exit $Code }
function Add-StubLog([string]$Line) {
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    Add-Content -LiteralPath (Join-Path $Dir 'stubs.log') -Value $Line -Encoding UTF8
}
function Get-Rand([int]$N) {
    if ($env:AMAZING_SEA_WALLPAPER_RANDOM) { return [Math]::Min([int]$env:AMAZING_SEA_WALLPAPER_RANDOM, $N - 1) }
    return Get-Random -Minimum 0 -Maximum $N
}
function Get-NowEpoch {
    if ($env:AMAZING_SEA_WALLPAPER_NOW_EPOCH) { return [long]$env:AMAZING_SEA_WALLPAPER_NOW_EPOCH }
    return [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
}
function Get-UtcToday {
    if ($env:AMAZING_SEA_WALLPAPER_TODAY) { return $env:AMAZING_SEA_WALLPAPER_TODAY }
    return [DateTime]::UtcNow.ToString('yyyy-MM-dd')
}
function ConvertTo-Local([long]$Epoch) { return [DateTimeOffset]::FromUnixTimeSeconds($Epoch).ToLocalTime() }
function Get-UtcEpoch([string]$Date, [int]$H) {
    $d = [DateTime]::ParseExact($Date, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
    return ([DateTimeOffset]::new($d.Year, $d.Month, $d.Day, $H, 0, 0, [TimeSpan]::Zero)).ToUnixTimeSeconds()
}

# key=value files, first match wins (the same format as the bash script)
function Get-Kv([string]$File, [string]$Key) {
    if (-not (Test-Path -LiteralPath $File)) { return '' }
    foreach ($l in (Get-Content -LiteralPath $File -Encoding UTF8)) {
        if ($l.StartsWith("$Key=")) { return $l.Substring($Key.Length + 1) }
    }
    return ''
}
function Set-KvFile([string]$File, [hashtable]$Set, [string[]]$Remove = @()) {
    $lines = @()
    if (Test-Path -LiteralPath $File) {
        foreach ($l in (Get-Content -LiteralPath $File -Encoding UTF8)) {
            $k = ($l -split '=', 2)[0]
            if (-not $Set.ContainsKey($k) -and $Remove -notcontains $k) { $lines += $l }
        }
    }
    foreach ($k in $Set.Keys) { $lines += "$k=$($Set[$k])" }
    $tmp = "$File.tmp.$PID"
    [IO.File]::WriteAllLines($tmp, [string[]]$lines, (New-Object Text.UTF8Encoding $false))
    Move-Item -LiteralPath $tmp -Destination $File -Force
}

# ---------- Windows: session, policy, setter ----------

function Test-Session {
    if ($Stubs) { return -not $env:AMAZING_SEA_WALLPAPER_STUB_NOSESSION }
    $sid = (Get-Process -Id $PID).SessionId
    return [bool](Get-Process -Name explorer -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $sid })
}

function Test-Policy {
    if ($Stubs) { return }
    if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') {
        Stop-Run 4 'PowerShell runs in Constrained Language Mode here (it blocks Add-Type): the wallpaper cannot be set'
    }
    foreach ($root in 'HKCU:', 'HKLM:') {
        $ad = Get-ItemProperty -Path "$root\Software\Microsoft\Windows\CurrentVersion\Policies\ActiveDesktop" -Name NoChangingWallPaper -ErrorAction SilentlyContinue
        if ($ad -and $ad.NoChangingWallPaper -eq 1) { Stop-Run 4 'wallpaper is set by policy (NoChangingWallPaper)' }
        $sys = Get-ItemProperty -Path "$root\Software\Microsoft\Windows\CurrentVersion\Policies\System" -Name Wallpaper -ErrorAction SilentlyContinue
        if ($sys -and $sys.Wallpaper) { Stop-Run 4 'wallpaper is set by policy (Policies\System\Wallpaper)' }
    }
}

function Set-Wallpaper([string]$Path) {
    if ($Stubs) { Add-StubLog "set-wallpaper $Path"; return $true }
    if (-not ('AmazingSea.Wallpaper' -as [type])) {
        Add-Type -Namespace AmazingSea -Name Wallpaper -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool SystemParametersInfoW(uint action, uint param, string value, uint flags);
[DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool SystemParametersInfoW(uint action, uint param, System.Text.StringBuilder value, uint flags);
'@
    }
    $key = 'HKCU:\Control Panel\Desktop'
    Set-ItemProperty -Path $key -Name WallpaperStyle -Value '10'   # Fill
    Set-ItemProperty -Path $key -Name TileWallpaper -Value '0'
    # SPI_SETDESKWALLPAPER, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
    if (-not [AmazingSea.Wallpaper]::SystemParametersInfoW(0x14, 0, $Path, 0x03)) {
        Write-AswLog ("SystemParametersInfo failed: error {0}" -f [Runtime.InteropServices.Marshal]::GetLastWin32Error())
        return $false
    }
    $sb = New-Object Text.StringBuilder 1024
    [void][AmazingSea.Wallpaper]::SystemParametersInfoW(0x73, 1024, $sb, 0)   # SPI_GETDESKWALLPAPER
    if ($sb.ToString() -ne $Path) { Write-AswLog "the desktop reads back '$($sb.ToString())'"; return $false }
    return $true
}

# ---------- Task Scheduler ----------

function Get-TaskAction([string]$Arguments) {
    $ps = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path -LiteralPath $ps)) { $ps = (Get-Process -Id $PID).Path }
    $file = "-NoProfile -ExecutionPolicy Bypass -File `"$Copy`""
    if ($Arguments) { $file = "$file $Arguments" }
    $build = [Environment]::OSVersion.Version.Build
    $show = (Get-Kv $ConfigFile 'show_window') -eq '1'
    if ($build -ge 17763 -and -not $show) {
        # no console flash (Windows 10 1809+); CRON.md section 2.4
        return New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$ps`" $file"
    }
    return New-ScheduledTaskAction -Execute $ps -Argument "-WindowStyle Hidden $file"
}
function Get-TaskSetting([switch]$Expire) {
    $p = @{ StartWhenAvailable = $true; AllowStartIfOnBatteries = $true; DontStopIfGoingOnBatteries = $true
        ExecutionTimeLimit = (New-TimeSpan -Minutes 30) }
    if ($Expire) { $p.DeleteExpiredTaskAfter = (New-TimeSpan -Seconds 1) }
    return New-ScheduledTaskSettingsSet @p
}
function Get-Principal { return New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive }

function Register-Daily([int]$H, [int]$M) {
    if ($Stubs) { Add-StubLog ('register-task {0} daily {1:D2}:{2:D2} random 5m, at logon' -f $Name, $H, $M); return }
    $daily = New-ScheduledTaskTrigger -Daily -At ('{0:D2}:{1:D2}' -f $H, $M) -RandomDelay (New-TimeSpan -Minutes 5)
    $logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    Register-ScheduledTask -TaskName $Name -TaskPath $TaskPath -Action (Get-TaskAction '') -Trigger $daily, $logon `
        -Settings (Get-TaskSetting) -Principal (Get-Principal) -Force | Out-Null
}
function Register-Retry([long]$Epoch) {
    $at = (ConvertTo-Local $Epoch).DateTime
    if ($Stubs) { Add-StubLog ('register-task {0}-retry once {1:yyyy-MM-dd HH:mm} until +6h' -f $Name, $at); return }
    $t = New-ScheduledTaskTrigger -Once -At $at
    $t.EndBoundary = $at.AddHours(6).ToString('s')
    Register-ScheduledTask -TaskName "$Name-retry" -TaskPath $TaskPath -Action (Get-TaskAction '-Retry') -Trigger $t `
        -Settings (Get-TaskSetting -Expire) -Principal (Get-Principal) -Force | Out-Null
}
function Unregister-Task([string]$TaskName) {
    if ($Stubs) { Add-StubLog "unregister-task $TaskName"; return }
    $t = Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
    if ($t) { Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false }
}
function Remove-TaskFolder {
    if ($Stubs) { Add-StubLog 'remove-task-folder'; return }
    try {
        $svc = New-Object -ComObject Schedule.Service
        $svc.Connect()
        $svc.GetFolder('\').DeleteFolder($Name, 0)
    } catch { Write-Verbose "task folder: $_" }
}

# ---------- downloads ----------

function Invoke-Fetch([string]$Uri, [string]$OutFile) {
    $proxy = Get-Kv $ConfigFile 'proxy'
    for ($try = 1; $try -le 3; $try++) {
        if (Test-Path -LiteralPath $OutFile) { Remove-Item -LiteralPath $OutFile -Force }
        $code = 0; $type = ''
        try {
            $p = @{ Uri = $Uri; OutFile = $OutFile; PassThru = $true; UseBasicParsing = $true; UserAgent = $UA; TimeoutSec = 60 }
            if ($proxy) { $p.Proxy = $proxy }
            if ($PSVersionTable.PSVersion.Major -ge 7) { $p.SkipHttpErrorCheck = $true }
            $r = Invoke-WebRequest @p
            $code = [int]$r.StatusCode
            $type = $r.Headers['Content-Type']
            if ($type -is [array]) { $type = $type[0] }
        } catch {
            # PS 5.1 throws on 404; read the status from the response
            $resp = $_.Exception.Response
            if ($resp) { $code = [int]$resp.StatusCode }
        }
        if ($code -ne 0 -and $code -lt 500) { break }
        if ($try -lt 3 -and -not $Stubs) { Start-Sleep -Seconds 5 }
    }
    return @{ Code = $code; Type = ([string]$type -split ';')[0].Trim() }
}

function Test-Image([hashtable]$R, [string]$File) {
    if ($R.Code -ne 200) { return "HTTP $($R.Code)" }
    if ($R.Type -ne 'image/jpeg') { return "Content-Type $($R.Type)" }
    $bytes = [IO.File]::ReadAllBytes($File)
    if ($bytes.Length -lt 2 -or $bytes[0] -ne 0xFF -or $bytes[1] -ne 0xD8) { return 'not a JPEG' }
    if ($bytes.Length -le 51200) { return "only $($bytes.Length) bytes" }
    return ''
}

function Read-JsonField([string]$File, [string]$Field) {
    try { return [string]((Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json).$Field) } catch { return '' }
}

# ---------- lock ----------

function Enter-Lock {
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    try { New-Item -ItemType Directory -Path $Lock -ErrorAction Stop | Out-Null }
    catch {
        $old = Get-Content -LiteralPath (Join-Path $Lock 'pid') -ErrorAction SilentlyContinue
        $age = ((Get-Date) - (Get-Item -LiteralPath $Lock).LastWriteTime).TotalSeconds
        $alive = $old -and (Get-Process -Id ([int]$old) -ErrorAction SilentlyContinue)
        if ($age -le 600 -and $alive) { return $false }
        Remove-Item -LiteralPath $Lock -Recurse -Force
        New-Item -ItemType Directory -Path $Lock | Out-Null
    }
    Set-Content -LiteralPath (Join-Path $Lock 'pid') -Value $PID
    return $true
}
function Exit-Run([int]$Code) {
    if (Test-Path -LiteralPath $Lock) { Remove-Item -LiteralPath $Lock -Recurse -Force -ErrorAction SilentlyContinue }
    exit $Code
}

function Limit-Log {
    if (-not (Test-Path -LiteralPath $LogFile)) { return }
    $lines = Get-Content -LiteralPath $LogFile -Encoding UTF8
    if ($lines.Count -gt 600) { $lines | Select-Object -Last 500 | Set-Content -LiteralPath $LogFile -Encoding UTF8 }
}

# ---------- the run (CRON.md section 4.3) ----------

function Get-RetryEpoch([long]$NowE) {
    $floor = Get-UtcEpoch (Get-UtcToday) 8
    $t = [Math]::Max($NowE + 10800, $floor)
    return $t + (Get-Rand 1801)
}

function Invoke-Prune([string]$Keep) {
    $files = Get-ChildItem -LiteralPath $Wall -File | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}\.jpg$' } | Sort-Object Name -Descending
    $n = 0
    foreach ($f in $files) {
        $n++
        if ($n -le 7 -or $f.FullName -eq $Keep) { continue }
        Remove-Item -LiteralPath $f.FullName -Force
    }
}

function Invoke-Run {
    $today = Get-UtcToday
    $nowE = Get-NowEpoch
    $localToday = (ConvertTo-Local $nowE).ToString('yyyy-MM-dd')
    if ($Mode -ne 'dry-run') {
        Limit-Log
        if (-not (Enter-Lock)) { Write-AswLog 'another run holds the lock'; exit 0 }
    }
    $installed = Test-Path -LiteralPath $ConfigFile
    $last = Get-Kv $StateFile 'date'
    $retryDay = Get-Kv $StateFile 'retry_day'
    $retryAt = Get-Kv $StateFile 'retry_at'

    if ($Mode -eq 'retry') { Unregister-Task "$Name-retry"; Set-KvFile $StateFile @{} @('retry_at') }
    elseif ($retryAt -and $nowE -gt ([long]$retryAt + 21600)) { Unregister-Task "$Name-retry"; Set-KvFile $StateFile @{} @('retry_at') }

    if ($last -eq $today -and $Mode -ne 'now' -and $Mode -ne 'dry-run') {
        Write-AswLog "today's picture ($today) is already set"; Exit-Run 0
    }

    $tries = 0
    while (-not (Test-Session)) {
        $tries++
        if (($Mode -eq 'now' -or $Mode -eq 'dry-run') -or $tries -gt 12) { Write-AswLog 'error: no desktop session (explorer.exe)'; Exit-Run 3 }
        if ($Stubs) { Add-StubLog 'sleep 10' } else { Start-Sleep -Seconds 10 }
    }
    if ($Mode -ne 'dry-run') { Test-Policy }

    if ((Get-Kv $ConfigFile 'portrait') -eq '1') { $kind = 'phone'; $json = 'latest-portrait' } else { $kind = 'pc'; $json = 'latest' }
    if ($Mode -eq 'dry-run') { $part = Join-Path ([IO.Path]::GetTempPath()) "$Name.$PID" }
    else { New-Item -ItemType Directory -Force -Path $Wall | Out-Null; $part = Join-Path $Wall ".part-$PID" }
    New-Item -ItemType Directory -Force -Path $part | Out-Null
    $img = Join-Path $part 'img'; $js = Join-Path $part 'json'
    $gotDate = ''; $gotTitle = ''; $status = 0

    try {
        # 3. today's dated image
        $r = Invoke-Fetch "${BaseUrl}daily/$kind/$today.jpg" $img
        $why = Test-Image $r $img
        if (-not $why) {
            $gotDate = $today
            $rj = Invoke-Fetch "${BaseUrl}daily/$kind/$today.json" $js
            if ($rj.Code -eq 200) { $gotTitle = Read-JsonField $js 'title' }
        } elseif ($r.Code -eq 0) { Write-AswLog "daily/$kind/$today.jpg: no answer from $BaseUrl"; $status = 1 }
        elseif ($r.Code -ne 404) { Write-AswLog "daily/$kind/$today.jpg: $why"; $status = 1 }

        # 4. catch up from latest
        $yesterday = [DateTime]::ParseExact($today, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture).AddDays(-1).ToString('yyyy-MM-dd')
        $catchUp = ([string]::CompareOrdinal($last, $yesterday) -lt 0) -or $Mode -in 'retry', 'now', 'dry-run'
        if (-not $gotDate -and $status -eq 0 -and $catchUp) {
            $rj = Invoke-Fetch "${BaseUrl}$json.json" $js
            if ($rj.Code -eq 200) {
                $latestDate = Read-JsonField $js 'date'
                if ($latestDate -notmatch '^\d{4}-\d{2}-\d{2}$') { Write-AswLog "$json.json has no date"; $status = 1 }
                elseif ([string]::CompareOrdinal($latestDate, $last) -gt 0 -or $Mode -in 'now', 'dry-run') {
                    $r = Invoke-Fetch "${BaseUrl}$json.jpg?d=$latestDate" $img
                    $why = Test-Image $r $img
                    if (-not $why) { $gotDate = $latestDate; $gotTitle = Read-JsonField $js 'title' }
                    else { Write-AswLog "$json.jpg: $why"; $status = 1 }
                }
            } else { Write-AswLog "$json.json: HTTP $($rj.Code) (nothing published?)"; $status = 1 }
        }

        if ($Mode -eq 'dry-run') {
            if ($gotDate) { Write-Output ('would set {0} "{1}" ({2} bytes) with SystemParametersInfo' -f $gotDate, $gotTitle, (Get-Item -LiteralPath $img).Length) }
            elseif ($status -eq 0) { Write-Output "nothing to set: today's ($today) isn't out yet" }
            else { Write-Output 'nothing to set: the download failed its check (above)' }
            if ($gotDate -ne $today) { Write-Output ('would schedule a re-run at {0:yyyy-MM-dd HH:mm}' -f (ConvertTo-Local (Get-RetryEpoch $nowE)).DateTime) }
            exit $status
        }

        # 6. set it
        if ($gotDate) {
            $file = Join-Path $Wall "$gotDate.jpg"
            Move-Item -LiteralPath $img -Destination $file -Force
            if (Set-Wallpaper $file) {
                $sha = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
                Set-KvFile $StateFile @{ date = $gotDate; sha256 = $sha; title = $gotTitle; set_at = $nowE }
                Invoke-Prune $file
                Write-AswLog "set ${gotDate}: $gotTitle"
                if ($gotDate -eq $today -and $installed -and (Get-Kv $StateFile 'retry_at')) { Unregister-Task "$Name-retry"; Set-KvFile $StateFile @{} @('retry_at') }
            } else { Write-AswLog 'setting the picture failed'; $status = 1 }
        }

        # 5. one re-run when today's isn't set
        if ($gotDate -ne $today -and $Mode -notin 'retry', 'now' -and $retryDay -ne $localToday) {
            if ($installed) {
                $e = Get-RetryEpoch $nowE
                Register-Retry $e
                Set-KvFile $StateFile @{ retry_day = $localToday; retry_at = $e }
                Write-AswLog ("today's picture isn't out yet: re-run at {0:HH:mm}" -f (ConvertTo-Local $e).DateTime)
            } else { Write-AswLog "today's picture isn't out yet (not installed: no re-run)" }
        } elseif ($gotDate -ne $today) { Write-AswLog "today's picture ($today) isn't out yet" }
    } finally {
        Remove-Item -LiteralPath $part -Recurse -Force -ErrorAction SilentlyContinue
    }
    Exit-Run $status
}

# ---------- install, uninstall, status, upgrade ----------

function Invoke-Install {
    if (-not $OnWindows -and -not $Stubs) { Stop-Run 4 'this script is for Windows; use amazing-sea-wallpaper.sh on Linux and macOS' }
    if (-not (Test-Session)) { Stop-Run 3 'no desktop session: run this from your desktop' }
    Test-Policy
    if (-not $Stubs) {
        foreach ($scope in 'MachinePolicy', 'UserPolicy') {
            $pol = Get-ExecutionPolicy -Scope $scope
            if ($pol -in 'Restricted', 'AllSigned') { Stop-Run 4 "PowerShell scripts are blocked by Group Policy ($scope = $pol)" }
        }
    }
    New-Item -ItemType Directory -Force -Path $Dir, $Wall | Out-Null
    $self = $PSCommandPath
    if ($self -ne $Copy) {
        $tmp = "$Copy.tmp.$PID"
        Copy-Item -LiteralPath $self -Destination $tmp -Force
        Move-Item -LiteralPath $tmp -Destination $Copy -Force
        if ($OnWindows -and -not $Stubs) { Unblock-File -LiteralPath $Copy }
    }
    $minute = Get-Kv $ConfigFile 'minute'
    if (-not $minute) { $minute = Get-Rand 60 }
    $h = $Hour
    if ($h -lt 0) { $saved = Get-Kv $ConfigFile 'hour'; if ($saved) { $h = [int]$saved } else { $h = 7 } }
    $proxy = ''
    if (-not $Stubs) {
        try { $sp = [Net.WebRequest]::GetSystemWebProxy().GetProxy([Uri]$BaseUrl); if ($sp.AbsoluteUri -ne ([Uri]$BaseUrl).AbsoluteUri) { $proxy = $sp.AbsoluteUri } } catch { $proxy = '' }
    }
    $cfg = [ordered]@{ minute = $minute; hour = $h; portrait = [int][bool]$Portrait; url = $BaseUrl; scheduler = 'taskscheduler'; proxy = $proxy; show_window = [int][bool]$ShowWindow }
    $lines = foreach ($k in $cfg.Keys) { "$k=$($cfg[$k])" }
    [IO.File]::WriteAllLines("$ConfigFile.tmp", [string[]]$lines, (New-Object Text.UTF8Encoding $false))
    Move-Item -LiteralPath "$ConfigFile.tmp" -Destination $ConfigFile -Force
    Register-Daily $h ([int]$minute)
    Write-Output "installed $Name $Version in $Dir"
    Write-Output ('  daily at {0:D2}:{1:D2} local and at logon (Task Scheduler \{2}\)' -f $h, [int]$minute, $Name)
    Write-Output "  command: powershell -ExecutionPolicy Bypass -File `"$Copy`" -Status"
    Write-Output "  setting today's picture now..."
    $script:Mode = 'now'
    Invoke-Run
}

function Invoke-Uninstall {
    Unregister-Task $Name
    Unregister-Task "$Name-retry"
    Remove-TaskFolder
    Write-Output 'removed the scheduled tasks'
    if (Test-Path -LiteralPath $Dir) {
        $ans = 'n'
        if ($Yes) { $ans = 'y' }
        elseif ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) { $ans = Read-Host "Delete $Dir (saved pictures, log, config)? [y/N]" }
        if ($ans -match '^(y|yes)$') { Remove-Item -LiteralPath $Dir -Recurse -Force; Write-Output "deleted $Dir" }
        else { Write-Output "kept $Dir" }
    }
}

function Show-Status {
    Write-Output "$Name $Version"
    if ($OnWindows) { $os = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).Caption } else { $os = $PSVersionTable.OS }
    Write-Output "  system:    $os (PowerShell $($PSVersionTable.PSVersion))"
    if (-not (Test-Path -LiteralPath $ConfigFile)) { Write-Output '  not installed (run -Install)'; return }
    Write-Output ('  schedule:  daily at {0:D2}:{1:D2} local and at logon, via Task Scheduler' -f [int](Get-Kv $ConfigFile 'hour'), [int](Get-Kv $ConfigFile 'minute'))
    if ($OnWindows -and -not $Stubs) {
        $t = Get-ScheduledTask -TaskName $Name -TaskPath $TaskPath -ErrorAction SilentlyContinue
        if (-not $t) { Write-Output '  ! the scheduled task is missing: run -Install again' }
        elseif ($t.State -eq 'Disabled') { Write-Output '  ! the scheduled task is disabled' }
        else { Write-Output "  next run:  $((Get-ScheduledTaskInfo -InputObject $t).NextRunTime)" }
    }
    if ((Get-Kv $ConfigFile 'portrait') -eq '1') { $pic = 'portrait (phone)' } else { $pic = 'landscape' }
    Write-Output "  picture:   $pic from $(Get-Kv $ConfigFile 'url')"
    if (Test-Path -LiteralPath $StateFile) {
        $setAt = Get-Kv $StateFile 'set_at'
        $when = ''; if ($setAt) { $when = '{0:yyyy-MM-dd HH:mm}' -f (ConvertTo-Local ([long]$setAt)).DateTime }
        Write-Output ('  last set:  {0} "{1}" at {2}' -f (Get-Kv $StateFile 'date'), (Get-Kv $StateFile 'title'), $when)
        Write-Output "  sha256:    $(Get-Kv $StateFile 'sha256')"
        $ra = Get-Kv $StateFile 'retry_at'
        if ($ra) { Write-Output ('  re-run:    pending at {0:yyyy-MM-dd HH:mm}' -f (ConvertTo-Local ([long]$ra)).DateTime) }
    }
    if (Test-Path -LiteralPath $LogFile) {
        Write-Output "  log ($LogFile):"
        Get-Content -LiteralPath $LogFile -Tail 10 -Encoding UTF8 | ForEach-Object { "    $_" }
    }
}

function Invoke-Upgrade {
    if (-not (Test-Path -LiteralPath $Copy)) { Stop-Run 4 'not installed (run -Install first)' }
    $src = $UpgradeUrl; if ($From) { $src = $From }
    $tmp = Join-Path $Dir ".upgrade.$PID.ps1"
    $r = Invoke-Fetch $src $tmp
    if ($r.Code -ne 200) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue; Stop-Run 1 "download failed: HTTP $($r.Code) from $src" }
    $errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($tmp, [ref]$null, [ref]$errors)
    if ($errors.Count -gt 0) { Remove-Item -LiteralPath $tmp -Force; Stop-Run 1 "the download doesn't parse: kept $Version" }
    $m = Select-String -LiteralPath $tmp -Pattern "^\`$Version = '(\d+\.\d+\.\d+)'" | Select-Object -First 1
    if (-not $m) { Remove-Item -LiteralPath $tmp -Force; Stop-Run 1 "the download has no version: kept $Version" }
    $new = $m.Matches[0].Groups[1].Value
    if ([version]$new -le [version]$Version) { Remove-Item -LiteralPath $tmp -Force; Write-Output "up to date ($Version; main has $new)"; return }
    Move-Item -LiteralPath $tmp -Destination $Copy -Force
    if ($OnWindows -and -not $Stubs) { Unblock-File -LiteralPath $Copy }
    Write-Output "upgraded $Version -> $new"
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Copy, '-Install', '-Url', (Get-Kv $ConfigFile 'url'), '-Hour', (Get-Kv $ConfigFile 'hour'))
    if ((Get-Kv $ConfigFile 'portrait') -eq '1') { $a += '-Portrait' }
    if ((Get-Kv $ConfigFile 'show_window') -eq '1') { $a += '-ShowWindow' }
    & (Get-Process -Id $PID).Path @a
    exit $LASTEXITCODE
}

# ---------- main ----------

if (-not $OnWindows -and -not $Stubs) { Write-Output 'amazing-sea-wallpaper.ps1 is for Windows; use amazing-sea-wallpaper.sh on Linux and macOS'; exit 4 }
if ($PSVersionTable.PSVersion.Major -le 5) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}
$BaseUrl = $Url
if (-not $BaseUrl) { $BaseUrl = Get-Kv $ConfigFile 'url' }
if (-not $BaseUrl) { $BaseUrl = $DefaultUrl }
if (-not $BaseUrl.EndsWith('/')) { $BaseUrl = "$BaseUrl/" }

switch ($Mode) {
    'install' { Invoke-Install }
    'uninstall' { Invoke-Uninstall }
    'status' { Show-Status }
    'upgrade' { Invoke-Upgrade }
    'schedule' {
        # the daily trigger has its own 5-minute RandomDelay
        Invoke-Run
    }
    default { Invoke-Run }
}
