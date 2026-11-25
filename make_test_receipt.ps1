# Synthetic receipt only; no personal transaction data.
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 900, 1150
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::White)
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$font = New-Object System.Drawing.Font 'Microsoft YaHei', 29
$title = New-Object System.Drawing.Font 'Microsoft YaHei', 38
$brush = [System.Drawing.Brushes]::Black
$graphics.DrawString('账单', $title, $brush, 45, 35)
$graphics.DrawString('2026年10月', $font, $brush, 45, 120)
$graphics.DrawString('本月支出 102.00', $font, $brush, 45, 185)
$lines = @('咖啡店', '-28.00', '2026-10-23 12:30', '地铁出行', '-4.00', '2026-10-22 08:10', '图书店', '-70.00', '2026-10-21 16:15')
$y = 290
foreach ($line in $lines) {
    $graphics.DrawString($line, $font, $brush, 45, $y)
    $y += 77
}
$bitmap.Save((Join-Path $PSScriptRoot 'data\synthetic-receipt.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$font.Dispose()
$title.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
