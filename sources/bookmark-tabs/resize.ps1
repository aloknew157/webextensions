Add-Type -AssemblyName System.Drawing

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$srcPath = Join-Path $scriptPath "icon.png"

if (-not (Test-Path $srcPath)) {
    Write-Error "Could not find source icon.png in the script directory."
    exit 1
}

$src = [System.Drawing.Image]::FromFile($srcPath)

foreach ($size in 16, 32, 48, 96, 128) {
    $destPath = Join-Path $scriptPath "icon-$size.png"
    Write-Host "Creating scaled icon: icon-$size.png..."
    
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Configure high-quality scaling settings
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $g.DrawImage($src, 0, 0, $size, $size)
    
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $bmp.Dispose()
}

$src.Dispose()
Write-Host "Resized icons successfully created."
