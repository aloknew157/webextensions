@echo off
echo ===================================================
echo Packaging Bookmark Tabs WebExtension (v2.1.0)
echo ===================================================
echo.

if not exist dist mkdir dist

REM 1. Package the runtime files into dist/bookmark-tabs.xpi
echo [1/2] Building installation package (dist/bookmark-tabs.xpi)...
powershell -NoProfile -Command "Compress-Archive -Path manifest.json, background.js, popup.html, popup.js, icon.png, icon-16.png, icon-32.png, icon-48.png, icon-96.png, icon-128.png -DestinationPath dist/bookmark-tabs.zip -Force; Move-Item -Path dist/bookmark-tabs.zip -Destination dist/bookmark-tabs.xpi -Force"

REM 2. Package the full source files (for Mozilla Add-on Store review) as dist/bookmark-tabs.zip
echo [2/2] Building source package for upload (dist/bookmark-tabs.zip)...
powershell -NoProfile -Command "Compress-Archive -Path manifest.json, background.js, popup.html, popup.js, icon.png, icon-16.png, icon-32.png, icon-48.png, icon-96.png, icon-128.png, README.md, CHANGELOG.md, resize.ps1, build_xpi.bat -DestinationPath dist/bookmark-tabs.zip -Force"

echo.
if exist dist\bookmark-tabs.xpi (
    echo [+] Success: Created dist\bookmark-tabs.xpi
) else (
    echo [-] Error: Failed to create dist\bookmark-tabs.xpi
)

if exist dist\bookmark-tabs.zip (
    echo [+] Success: Created dist\bookmark-tabs.zip
) else (
    echo [-] Error: Failed to create dist\bookmark-tabs.zip
)
echo.
pause
