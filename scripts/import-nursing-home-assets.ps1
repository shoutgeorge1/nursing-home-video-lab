#Requires -Version 5.1
# Copies Cursor workspace PNGs into repo assets/nursing-home/ as 1080x1920 JPEGs with canonical names.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $repoRoot 'assets\nursing-home'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$cursorAssets = 'C:\Users\georgea\.cursor\projects\c-Users-georgea-nursing-home-video-lab\assets'

# Canonical output filename -> source filename fragment (unique match under $cursorAssets)
function Get-Win32LongPath([string]$path) {
  if ([string]::IsNullOrEmpty($path)) { return $path }
  if ($path.StartsWith('\\?\')) { return $path }
  if ($path.Length -lt 248) { return $path }
  if ($path.StartsWith('\\')) { return '\\?\UNC\' + $path.Substring(2).TrimStart('\') }
  return '\\?\' + $path.TrimStart('\')
}

$map = [ordered]@{
  'black_white_elder_drinking.jpg'           = 'black_white_grainy_image_elder_sippingwaterinbed-c8cdc18e'
  'daughter_holding_hand.jpg'                = 'daughter-hold-dads-hand-64c98bd5'
  'bedside_family.jpg'                       = 'daughter-holds-mother-wheelchair-b5d51039'
  'nurse_on_phone_ignoring.jpg'              = 'nurse_ignoring_elder_on_phone-5f425c07'
  'unattended_patient.jpg'                   = 'woman-nursing-care-bed-very-dark-sad-9181868a'
  'nurse_checking_bedsore.jpg'               = 'nurse-checks-bedsore-5acdee72'
  'nurse_charting.jpg'                       = 'nurse-chart-22b98a53'
  'attorney_reviewing_documents.jpg'        = 'attorney-reviews-paperwork-medical-records-ad89ef6d'
  'call_now_screen.jpg'                      = 'call_now_text_on_lab_top-bb92f599'
  'elderly_wheelchair_window_dark.jpg'     = 'elder_man_wheelchair_looking_out_window_dark-4fbe2700'
  'worried_daughter_couch.jpg'               = 'worried_sick_middle_aged_daughter_black-8291051e'
  'repositioning_patient.jpg'                = 'nurses-adjust-patient-aab100ec'
  'male_attorney_papers.jpg'                 = 'Male-Attorney-Reviewing-Paperwork-1-f2c0c7fc'
}

function Find-Source($fragment) {
  $g = Get-ChildItem -Path $cursorAssets -Recurse -Filter '*.png' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*$fragment*" }
  if (-not $g) { throw "No PNG matching fragment: $fragment" }
  return $g[0].FullName
}

function Save-CoverJpeg([string]$srcPath, [string]$destPath, [int]$tw, [int]$th) {
  $src = [System.Drawing.Image]::FromFile((Get-Win32LongPath $srcPath))
  try {
    $scale = [Math]::Max($tw / $src.Width, $th / $src.Height)
    $nw = [int][Math]::Ceiling($src.Width * $scale)
    $nh = [int][Math]::Ceiling($src.Height * $scale)
    $scaled = New-Object System.Drawing.Bitmap $nw, $nh
    $g0 = [System.Drawing.Graphics]::FromImage($scaled)
    $g0.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g0.DrawImage($src, 0, 0, $nw, $nh)
    $g0.Dispose()

    $out = New-Object System.Drawing.Bitmap $tw, $th
    $g1 = [System.Drawing.Graphics]::FromImage($out)
    $g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $ox = [int](($nw - $tw) / 2)
    $oy = [int](($nh - $th) / 2)
    $srcRect = New-Object System.Drawing.Rectangle $ox, $oy, $tw, $th
    $dstRect = New-Object System.Drawing.Rectangle 0, 0, $tw, $th
    $g1.DrawImage($scaled, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g1.Dispose()
    $scaled.Dispose()

    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]90)
    $out.Save($destPath, $enc, $ep)
    $out.Dispose()
  }
  finally {
    $src.Dispose()
  }
}

foreach ($destName in $map.Keys) {
  $frag = $map[$destName]
  $srcPath = Find-Source $frag
  $destPath = Join-Path $outDir $destName
  Write-Host "Import $destName <= $($srcPath.Split('\')[-1])"
  Save-CoverJpeg $srcPath $destPath 1080 1920
}

Write-Host "Imported $($map.Count) files into $outDir"
