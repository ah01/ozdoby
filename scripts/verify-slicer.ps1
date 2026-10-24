param([string]$Slicer = 'C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path -LiteralPath $Slicer)) { throw 'PrusaSlicer nebyl nalezen. Zadejte cestu parametrem -Slicer.' }
& npm.cmd run fixtures
if ($LASTEXITCODE -ne 0) { throw 'Generování referenčních souborů selhalo.' }
New-Item -ItemType Directory -Force 'doc\verification\.scratch' | Out-Null
foreach ($testCase in @(@('S01', 'S01-elongated-smooth'), @('S02', 'S02-short-wide-risk'))) {
  $caseId = $testCase[0]
  $modelPath = "doc\verification\fixtures\$($testCase[1]).stl"
  & $Slicer --info $modelPath 2>&1 | Tee-Object -FilePath "doc\verification\$caseId-info.log"
  if ($LASTEXITCODE -ne 0) { throw "$caseId : načtení STL selhalo." }
  & $Slicer --load 'doc\verification\phase-0-slicer.ini' --export-gcode --save 'doc\verification\.scratch\resolved-profile.ini' --output "doc\verification\.scratch\$caseId.gcode" $modelPath 2>&1 | Tee-Object -FilePath "doc\verification\$caseId-slicer.log"
  if ($LASTEXITCODE -ne 0) { throw "$caseId : slicing selhal." }
}
& npx.cmd --no-install tsx scripts/inspect-gcode.ts
if ($LASTEXITCODE -ne 0) { throw 'Kontrola G-code selhala.' }
