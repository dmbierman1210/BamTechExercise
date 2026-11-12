@echo off
setlocal EnableExtensions
rem ============================================================================
rem  Stargate ACTS - stop the servers started by start-demo.bat
rem  Stops whatever is listening on the API, UI and mock-API ports, and closes
rem  the launcher windows. It prints each process it stops.
rem ============================================================================
title ACTS stop
if "%ACTS_API_PORT%"=="" set "ACTS_API_PORT=5204"
if "%ACTS_UI_PORT%"=="" set "ACTS_UI_PORT=4200"
set "MOCK_PORT=3000"

echo.
echo  Stopping the Stargate ACTS servers...
echo.
call :killport %ACTS_API_PORT% "API"
call :killport %ACTS_UI_PORT% "UI"
call :killport %MOCK_PORT% "mock API"

taskkill /FI "WINDOWTITLE eq ACTS API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ACTS UI*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ACTS mock API*" /T /F >nul 2>&1

echo.
echo  Done.
echo.
if not "%ACTS_NO_PAUSE%"=="1" pause
exit /b 0

:killport
set "FOUND=0"
for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%~1 .*LISTENING"') do call :killpid %%I %~1 %2
if "%FOUND%"=="0" echo  Nothing was listening on port %~1, the %~2 was not running.
exit /b 0

:killpid
set "FOUND=1"
echo  Stopping the %~3 on port %~2, process %~1
taskkill /PID %~1 /T /F >nul 2>&1
exit /b 0
