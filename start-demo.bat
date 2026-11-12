@echo off
setlocal EnableExtensions
rem ============================================================================
rem  Stargate ACTS - one-click launcher
rem  Starts the API and the UI, waits until both answer, then opens the app in a
rem  brand new browser window. Double-click this file. Run stop-demo.bat to stop.
rem
rem  Optional environment variables (mostly for testing):
rem    ACTS_API_PORT    API port, default 5204
rem    ACTS_UI_PORT     UI port, default 4200
rem    ACTS_NO_BROWSER  set to 1 to skip opening the browser
rem    ACTS_NO_PAUSE    set to 1 to skip the final "press any key"
rem ============================================================================
title ACTS launcher
set "ROOT=%~dp0"
if "%ACTS_API_PORT%"=="" set "ACTS_API_PORT=5204"
if "%ACTS_UI_PORT%"=="" set "ACTS_UI_PORT=4200"
set "MOCK_PORT=3000"

echo.
echo  ====================================================
echo   Stargate ACTS - Astronaut Career Tracking System
echo  ====================================================
echo.

rem ---- 1. Prerequisites -------------------------------------------------------
where dotnet >nul 2>&1
if errorlevel 1 (
  echo [!] The .NET SDK was not found. Install the .NET 8 SDK: https://dotnet.microsoft.com/download
  goto :fail
)
dotnet --list-sdks | findstr /b /c:"8." >nul
if errorlevel 1 (
  echo [!] No .NET 8 SDK found. This project needs .NET 8: https://dotnet.microsoft.com/download
  goto :fail
)
where node >nul 2>&1
if errorlevel 1 (
  echo [!] Node.js was not found. Install Node 22 or newer: https://nodejs.org
  goto :fail
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [!] npm was not found. It comes with Node.js: https://nodejs.org
  goto :fail
)
where curl.exe >nul 2>&1
if errorlevel 1 (
  echo [!] curl.exe was not found. It ships with Windows 10 and 11.
  goto :fail
)
echo [ok] .NET 8, Node and npm found.

rem ---- 2. Ports must be free --------------------------------------------------
call :checkport %ACTS_API_PORT% "the API"
if errorlevel 1 goto :fail
call :checkport %ACTS_UI_PORT% "the UI"
if errorlevel 1 goto :fail

rem ---- 3. Does the UI still point at the mock API? ----------------------------
rem  Until the UI is wired to the real API its development build talks to a mock
rem  on port 3000. If so, start the mock too so the app has data.
set "NEED_MOCK=0"
findstr /c:"apiBaseUrl: 'http://localhost:3000'" "%ROOT%ui\src\environments\environment.development.ts" >nul 2>&1
if not errorlevel 1 set "NEED_MOCK=1"
if "%NEED_MOCK%"=="1" (
  call :checkport %MOCK_PORT% "the mock API"
  if errorlevel 1 goto :fail
  echo [ok] The UI is set to use the mock API, so the mock will be started too.
)

rem ---- 4. First run: install the UI packages ----------------------------------
if exist "%ROOT%ui\node_modules" goto :packages_ok
echo [..] First run: installing the UI packages. This takes a minute or two.
pushd "%ROOT%ui"
call npm ci --no-audit --no-fund
if errorlevel 1 goto :npmfail
popd
:packages_ok

rem ---- 5. Start the servers, each in its own window ---------------------------
echo [..] Starting the API on http://localhost:%ACTS_API_PORT% ...
start "ACTS API" /D "%ROOT%api" cmd /k "set ASPNETCORE_ENVIRONMENT=Development&& set ASPNETCORE_URLS=http://localhost:%ACTS_API_PORT%&& dotnet run --no-launch-profile"

if "%NEED_MOCK%"=="1" (
  echo [..] Starting the mock API on http://localhost:%MOCK_PORT% ...
  start "ACTS mock API" /D "%ROOT%ui" cmd /k "npm run start:mock"
)

echo [..] Starting the UI on http://localhost:%ACTS_UI_PORT% ...
start "ACTS UI" /D "%ROOT%ui" cmd /k "npm run start:app -- --port %ACTS_UI_PORT%"

rem ---- 6. Wait until everything answers ---------------------------------------
call :waitfor "http://localhost:%ACTS_API_PORT%/Person" "the API"
if errorlevel 1 goto :fail
if "%NEED_MOCK%"=="1" (
  call :waitfor "http://localhost:%MOCK_PORT%/Person" "the mock API"
  if errorlevel 1 goto :fail
)
call :waitfor "http://localhost:%ACTS_UI_PORT%/" "the UI"
if errorlevel 1 goto :fail

rem ---- 7. Open a brand new browser window in its own clean profile ------------
rem  A separate profile keeps your normal browser (and any work profile, extensions
rem  or saved state) out of the demo. Edge first, then Chrome, then the default.
set "APP_URL=http://localhost:%ACTS_UI_PORT%/"
if "%ACTS_NO_BROWSER%"=="1" goto :summary
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" >nul 2>&1
if not errorlevel 1 goto :openedge
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1
if not errorlevel 1 goto :openchrome
reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1
if not errorlevel 1 goto :openchrome
start "" "%APP_URL%"
goto :summary

:openedge
start "" msedge --new-window --user-data-dir="%TEMP%\acts-demo-browser" --no-first-run --no-default-browser-check "%APP_URL%"
goto :summary

:openchrome
start "" chrome --new-window --user-data-dir="%TEMP%\acts-demo-browser" --no-first-run --no-default-browser-check "%APP_URL%"
goto :summary

:summary
echo.
echo  ====================================================
echo   Everything is running.
echo.
echo   App (UI):        %APP_URL%
echo   API docs:        http://localhost:%ACTS_API_PORT%/swagger
echo.
echo   First time in the app: click "Acting as" in the top bar and
echo   type your name once. Changes need a name, it is recorded in
echo   the audit trail.
echo.
echo   To stop everything: run stop-demo.bat, or close the
echo   "ACTS API" and "ACTS UI" windows.
echo  ====================================================
echo.
if not "%ACTS_NO_PAUSE%"=="1" pause
exit /b 0

rem ============================================================================
:npmfail
popd
echo [!] npm ci failed. Read the messages above.
goto :fail

:fail
echo.
echo  The launcher stopped. Nothing else was changed.
echo.
if not "%ACTS_NO_PAUSE%"=="1" pause
exit /b 1

rem ---- subroutine: is a port free? ---------------------------------------------
:checkport
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul
if not errorlevel 1 (
  echo [!] Port %~1 is already in use, but it is needed for %~2.
  echo     Run stop-demo.bat, or close the program using it, then try again.
  exit /b 1
)
exit /b 0

rem ---- subroutine: wait until a URL answers, give up after 4 minutes -----------
:waitfor
set /a TRIES=0
:waitloop
curl.exe -s -f -o NUL "%~1" >nul 2>&1
if not errorlevel 1 (
  echo [ok] %~2 is ready.
  exit /b 0
)
set /a TRIES+=1
if %TRIES% GEQ 120 goto :waitfail
ping -n 3 127.0.0.1 >nul
goto :waitloop
:waitfail
echo [!] %~2 did not answer within 4 minutes. Look at its window for the error.
exit /b 1
