#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $root 'assets\nursing-home'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$names = @(
  'black_white_elder_drinking.jpg',
  'daughter_holding_hand.jpg',
  'bedside_family.jpg',
  'nurse_on_phone_ignoring.jpg',
  'unattended_patient.jpg',
  'nurse_checking_bedsore.jpg',
  'nurse_charting.jpg',
  'attorney_reviewing_documents.jpg',
  'call_now_screen.jpg',
  'elderly_wheelchair_window_dark.jpg',
  'worried_daughter_couch.jpg',
  'repositioning_patient.jpg',
  'male_attorney_papers.jpg'
)

$w = 1080
$h = 1920

foreach ($name in $names) {
  $dest = Join-Path $outDir $name
  if (Test-Path -LiteralPath $dest) {
    $len = (Get-Item -LiteralPath $dest).Length
    if ($len -gt 4096) { continue }
  }

  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $c1 = [System.Drawing.Color]::FromArgb(255, 12, 18, 32)
  $c2 = [System.Drawing.Color]::FromArgb(255, 28, 22, 58)
  $c3 = [System.Drawing.Color]::FromArgb(255, 58, 24, 16)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect, $c1, $c3, [single]52.0
  )
  $cb = New-Object System.Drawing.Drawing2D.ColorBlend(3)
  $cb.Colors = @($c1, $c2, $c3)
  $cb.Positions = @(0.0, 0.48, 1.0)
  $brush.InterpolationColors = $cb
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()

  $font = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 0, 0, 0))
  $fg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 248, 250, 252))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

  $off = New-Object System.Drawing.RectangleF (40, 60, [float]($w - 80), [float]($h - 120))
  $g.DrawString($name, $font, $shadow, $off, $sf)
  $main = New-Object System.Drawing.RectangleF (38, 58, [float]($w - 80), [float]($h - 120))
  $g.DrawString($name, $font, $fg, $main, $sf)

  $font.Dispose()
  $shadow.Dispose()
  $fg.Dispose()
  $sf.Dispose()

  $g.Dispose()
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $bmp.Dispose()
  Write-Host "Wrote $dest"
}

Write-Host 'Done.'
