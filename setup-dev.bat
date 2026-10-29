@echo off
REM AniLust Development Setup Script (Windows)
REM Run this script to set up both frontend and backend for local development

setlocal enabledelayedexpansion

echo.
echo 🚀 Setting up AniLust development environment...
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Found Node.js: %NODE_VERSION%
echo.

REM Setup Backend
echo 📦 Setting up Backend Server...
cd server

if not exist ".env" (
    echo Creating backend .env file...
    (
        echo FRONTEND_URL=http://localhost:3000
        echo PORT=5000
        echo DEBUG=true
    ) > .env
    echo ✅ Backend .env created
) else (
    echo ℹ️  Backend .env already exists
)

echo Installing backend dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)

echo ✅ Backend setup complete
echo.

REM Setup Frontend
cd ..
echo 📦 Setting up Frontend...

if not exist ".env" (
    echo Creating frontend .env file...
    (
        echo VITE_BACKEND_URL=http://localhost:5000
        echo VITE_HIANIME_API_URL=
    ) > .env
    echo ✅ Frontend .env created
) else (
    echo ℹ️  Frontend .env already exists
)

echo Installing frontend dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)

echo ✅ Frontend setup complete
echo.

REM Summary
echo ═══════════════════════════════════════════════════════════
echo ✨ Setup Complete! Here's what to do next:
echo.
echo 1. Start the Backend (in one terminal):
echo    cd server ^&^& npm run dev
echo.
echo 2. Start the Frontend (in another terminal):
echo    npm run dev
echo.
echo 3. Open your browser:
echo    http://localhost:3000
echo.
echo ═══════════════════════════════════════════════════════════
echo.
pause
