@echo off
echo ===================================================
echo Firefox Add-on Cache Cleaner and Ext remover
echo ===================================================
echo.
echo Closing Firefox to unlock files...
taskkill /F /IM firefox.exe 2>nul

echo.
echo Deleting bookmark-tabs@4dash2.xpi from all profiles...
if exist "D:\Apps\Firefox\Profile\release\extensions\bookmark-tabs@4dash2.xpi" (
    del "D:\Apps\Firefox\Profile\release\extensions\bookmark-tabs@4dash2.xpi" /Q
    echo Removed from release profile.
)
if exist "D:\Apps\Firefox\Profile\developer\extensions\bookmark-tabs@4dash2.xpi" (
    del "D:\Apps\Firefox\Profile\developer\extensions\bookmark-tabs@4dash2.xpi" /Q
    echo Removed from developer profile.
)
if exist "D:\Apps\Firefox\Profile\nightly\extensions\bookmark-tabs@4dash2.xpi" (
    del "D:\Apps\Firefox\Profile\nightly\extensions\bookmark-tabs@4dash2.xpi" /Q
    echo Removed from nightly profile.
)
if exist "D:\Apps\Firefox\Profile\esr\extensions\bookmark-tabs@4dash2.xpi" (
    del "D:\Apps\Firefox\Profile\esr\extensions\bookmark-tabs@4dash2.xpi" /Q
    echo Removed from esr profile.
)
if exist "D:\Apps\Firefox\Profile\winstore\extensions\bookmark-tabs@4dash2.xpi" (
    del "D:\Apps\Firefox\Profile\winstore\extensions\bookmark-tabs@4dash2.xpi" /Q
    echo Removed from winstore profile.
)

echo.
echo Deleting addonStartup and startupCache files...
for %%P in (release developer nightly esr winstore) do (
    if exist "D:\Apps\Firefox\Profile\%%P\startupCache\webext.sc.lz4" (
        del "D:\Apps\Firefox\Profile\%%P\startupCache\webext.sc.lz4" /Q
        echo Cleared webext startup cache in %%P profile.
    )
    if exist "D:\Apps\Firefox\Profile\%%P\addonStartup.json.lz4" (
        del "D:\Apps\Firefox\Profile\%%P\addonStartup.json.lz4" /Q
        echo Cleared addonStartup cache in %%P profile.
    )
)

echo.
echo Done! Please restart Firefox and perform a clean install.
pause
