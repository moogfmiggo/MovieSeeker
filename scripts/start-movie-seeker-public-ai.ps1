[CmdletBinding()]
param(
  [string]$ProjectScope = "moogfmiggo",
  [string]$ProjectName = "movie-seeker",
  [string]$ProductionAlias = "movie-seeker-alpha.vercel.app"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$statePath = Join-Path $env:LOCALAPPDATA "MovieSeeker"
$logPath = Join-Path $statePath "logs"
$tokenPath = Join-Path $statePath "ai-token.dpapi"
$startupLogPath = Join-Path $logPath "startup.log"
$aiPidPath = Join-Path $statePath "ai-server.pid"
$tunnelPidPath = Join-Path $statePath "cloudflared.pid"
$tunnelUrlPath = Join-Path $statePath "tunnel-url.txt"

New-Item -ItemType Directory -Path $logPath -Force | Out-Null

function Write-StartupLog([string]$Message) {
  $line = "{0:u} {1}" -f (Get-Date), $Message
  Add-Content -LiteralPath $startupLogPath -Value $line
  Write-Host $line
}

function Get-OrCreateSharedToken {
  if (Test-Path -LiteralPath $tokenPath) {
    $encrypted = Get-Content -Raw -LiteralPath $tokenPath
    $secure = ConvertTo-SecureString $encrypted
    return (New-Object Net.NetworkCredential("", $secure)).Password
  }

  $bytes = New-Object byte[] 32
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }

  $token = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
  $secure = ConvertTo-SecureString $token -AsPlainText -Force
  [IO.File]::WriteAllText($tokenPath, (ConvertFrom-SecureString $secure))
  return $token
}

function Stop-MovieSeekerProcesses([string]$ExecutableName, [string]$CommandFragment) {
  $processes = Get-CimInstance Win32_Process -Filter "Name = '$ExecutableName'" -ErrorAction SilentlyContinue
  foreach ($process in $processes) {
    if (
      $process.CommandLine -and
      $process.CommandLine.IndexOf($CommandFragment, [StringComparison]::OrdinalIgnoreCase) -ge 0
    ) {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Test-HttpReady([string]$Uri) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-ForHttp([string]$Uri, [int]$Attempts, [string]$Label) {
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if (Test-HttpReady $Uri) {
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "$Label did not become ready."
}

function Resolve-CloudflaredPath {
  $command = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $knownPaths = @(
    "C:\Program Files (x86)\cloudflared\cloudflared.exe",
    "C:\Program Files\cloudflared\cloudflared.exe"
  )
  foreach ($path in $knownPaths) {
    if (Test-Path -LiteralPath $path) {
      return $path
    }
  }
  throw "cloudflared.exe is not installed."
}

$aiProcess = $null
$tunnelProcess = $null

try {
  Write-StartupLog "Starting MovieSeeker public AI."
  $sharedToken = Get-OrCreateSharedToken
  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  $npxPath = (Get-Command npx.cmd -ErrorAction Stop).Source
  $cloudflaredPath = Resolve-CloudflaredPath

  if (-not (Test-HttpReady "http://127.0.0.1:11434/api/tags")) {
    $ollamaPath = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
    if (-not (Test-Path -LiteralPath $ollamaPath)) {
      throw "Ollama is not installed in the expected location."
    }
    Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden | Out-Null
    Wait-ForHttp "http://127.0.0.1:11434/api/tags" 30 "Ollama"
  }

  Stop-MovieSeekerProcesses "node.exe" "movie-seeker-ai-server.mjs"
  Stop-MovieSeekerProcesses "cloudflared.exe" "127.0.0.1:4317"

  $env:MOVIESEEKER_AI_TOKEN = $sharedToken
  $env:MOVIESEEKER_AI_HOST = "127.0.0.1"
  $env:MOVIESEEKER_AI_PORT = "4317"
  $env:OLLAMA_URL = "http://127.0.0.1:11434"
  $env:OLLAMA_MODEL = "qwen3.5:9b"
  try {
    $aiProcess = Start-Process `
      -FilePath $nodePath `
      -ArgumentList "scripts/movie-seeker-ai-server.mjs" `
      -WorkingDirectory $repositoryPath `
      -WindowStyle Hidden `
      -PassThru `
      -RedirectStandardOutput (Join-Path $logPath "ai-server.out.log") `
      -RedirectStandardError (Join-Path $logPath "ai-server.err.log")
  } finally {
    Remove-Item `
      Env:MOVIESEEKER_AI_TOKEN, `
      Env:MOVIESEEKER_AI_HOST, `
      Env:MOVIESEEKER_AI_PORT, `
      Env:OLLAMA_URL, `
      Env:OLLAMA_MODEL `
      -ErrorAction SilentlyContinue
  }
  [IO.File]::WriteAllText($aiPidPath, [string]$aiProcess.Id)
  Wait-ForHttp "http://127.0.0.1:4317/health" 30 "MovieSeeker AI Server"

  $cloudflaredOut = Join-Path $logPath "cloudflared.out.log"
  $cloudflaredError = Join-Path $logPath "cloudflared.err.log"
  $tunnelProcess = Start-Process `
    -FilePath $cloudflaredPath `
    -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:4317") `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $cloudflaredOut `
    -RedirectStandardError $cloudflaredError
  [IO.File]::WriteAllText($tunnelPidPath, [string]$tunnelProcess.Id)

  $tunnelUrl = $null
  for ($attempt = 1; $attempt -le 30 -and -not $tunnelUrl; $attempt++) {
    Start-Sleep -Seconds 2
    $logText =
      (Get-Content -Raw -LiteralPath $cloudflaredOut -ErrorAction SilentlyContinue) + "`n" +
      (Get-Content -Raw -LiteralPath $cloudflaredError -ErrorAction SilentlyContinue)
    $match = [regex]::Match($logText, "https://[a-z0-9-]+\.trycloudflare\.com")
    if ($match.Success) {
      $tunnelUrl = $match.Value
    }
  }
  if (-not $tunnelUrl) {
    throw "Cloudflare Quick Tunnel did not return a public URL."
  }
  [IO.File]::WriteAllText($tunnelUrlPath, $tunnelUrl)
  Wait-ForHttp "$tunnelUrl/health" 15 "Cloudflare Quick Tunnel"

  if (-not (Test-Path -LiteralPath (Join-Path $repositoryPath ".vercel\project.json"))) {
    & $npxPath vercel link --yes --project $ProjectName --scope $ProjectScope
    if ($LASTEXITCODE -ne 0) {
      throw "Vercel project linking failed."
    }
  }

  $tunnelUrl | & $npxPath vercel env add MOVIESEEKER_AI_SERVER_URL production --yes --sensitive --force
  if ($LASTEXITCODE -ne 0) {
    throw "Updating MOVIESEEKER_AI_SERVER_URL failed."
  }
  $sharedToken | & $npxPath vercel env add MOVIESEEKER_AI_SERVER_TOKEN production --yes --sensitive --force
  if ($LASTEXITCODE -ne 0) {
    throw "Updating MOVIESEEKER_AI_SERVER_TOKEN failed."
  }

  & $npxPath vercel redeploy $ProductionAlias --target production
  if ($LASTEXITCODE -ne 0) {
    throw "Vercel production redeploy failed."
  }

  Write-StartupLog "MovieSeeker public AI is online and Vercel was redeployed."
} catch {
  Write-StartupLog "ERROR: $($_.Exception.Message)"
  if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($aiProcess -and -not $aiProcess.HasExited) {
    Stop-Process -Id $aiProcess.Id -Force -ErrorAction SilentlyContinue
  }
  exit 1
}
