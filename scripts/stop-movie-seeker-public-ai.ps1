[CmdletBinding()]
param(
  [string]$OllamaModel = "qwen3.5:9b"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$statePath = Join-Path $env:LOCALAPPDATA "MovieSeeker"
$logPath = Join-Path $statePath "logs"
$startupLogPath = Join-Path $logPath "startup.log"
$aiPidPath = Join-Path $statePath "ai-server.pid"
$tunnelPidPath = Join-Path $statePath "cloudflared.pid"

New-Item -ItemType Directory -Path $logPath -Force | Out-Null

function Stop-MovieSeekerProcesses(
  [string]$ExecutableName,
  [string]$CommandFragment
) {
  $stopped = 0
  $processes = Get-CimInstance Win32_Process -Filter "Name = '$ExecutableName'" -ErrorAction SilentlyContinue
  foreach ($process in $processes) {
    if (
      $process.CommandLine -and
      $process.CommandLine.IndexOf($CommandFragment, [StringComparison]::OrdinalIgnoreCase) -ge 0
    ) {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
      $stopped++
    }
  }
  return $stopped
}

function Resolve-OllamaPath {
  $command = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $knownPath = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  if (Test-Path -LiteralPath $knownPath) {
    return $knownPath
  }
  return $null
}

$aiStopped = Stop-MovieSeekerProcesses "node.exe" "movie-seeker-ai-server.mjs"
$tunnelStopped = Stop-MovieSeekerProcesses "cloudflared.exe" "127.0.0.1:4317"
$ollamaModelStopped = $false
$ollamaPath = Resolve-OllamaPath
if ($ollamaPath) {
  & $ollamaPath stop $OllamaModel 2>$null | Out-Null
  $ollamaModelStopped = $LASTEXITCODE -eq 0
}

# PID files contain no reusable state. Removing them prevents a later status
# check from mistaking a recycled Windows PID for MovieSeeker's process.
Remove-Item -LiteralPath $aiPidPath, $tunnelPidPath -Force -ErrorAction SilentlyContinue

$message = if ($aiStopped + $tunnelStopped -gt 0 -or $ollamaModelStopped) {
  "MovieSeeker AI Server stopped and $OllamaModel was unloaded from the GPU. Website searches will use the immediate Genre fallback."
} else {
  "MovieSeeker AI Server and $OllamaModel were already stopped."
}
$line = "{0:u} {1}" -f (Get-Date), $message
Add-Content -LiteralPath $startupLogPath -Value $line
Write-Host $line
