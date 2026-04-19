@echo off
setlocal EnableDelayedExpansion

if "%REAL_NPM_NODE%"=="" exit /b 1
if "%REAL_NPM_CLI%"=="" exit /b 1

set "args="

:loop
if "%~1"=="" goto run
if "%~1"=="--prod" (
  set "args=!args! --omit=dev"
) else (
  set "args=!args! %~1"
)
shift
goto loop

:run
"%REAL_NPM_NODE%" "%REAL_NPM_CLI%" %args%

