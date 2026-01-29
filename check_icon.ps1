Add-Type -AssemblyName System.Drawing
try {
    $img = [System.Drawing.Image]::FromFile("i:\mehdi calc\calc\logo.png")
    Write-Host "Width: $($img.Width) Height: $($img.Height)"
    $img.Dispose()
} catch {
    Write-Host "Error loading image: $_"
}
