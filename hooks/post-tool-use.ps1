# NanoFarm claude code hook: appends one record per tool call to %USERPROFILE%\.nanofarm\tokens.jsonl.
# wired up via PostToolUse in claude code's settings.json (see ./INSTALL.md).

$ErrorActionPreference = "Stop"

$dir = Join-Path $env:USERPROFILE ".nanofarm"
if (-not (Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir | Out-Null
}
$file = Join-Path $dir "tokens.jsonl"

$raw = [Console]::In.ReadToEnd()

$tool = "unknown"
try {
  $obj = $raw | ConvertFrom-Json
  if ($null -ne $obj.tool_name) {
    $tool = [string]$obj.tool_name
  }
} catch {
  # leave tool as "unknown"; we still record the call so the count moves
}

$ts = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$record = [PSCustomObject]@{ t = $ts; tool = $tool; v = 1 }
$line = ($record | ConvertTo-Json -Compress) + "`n"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::AppendAllText($file, $line, $utf8NoBom)
