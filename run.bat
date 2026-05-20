@echo off
echo Starting Smart Attendance System...

:: Change directory to the folder where the batch file is located
cd /d "%~dp0"

:: Start the Flask backend in a separate terminal window
echo Starting backend...
start "Smart Attendance Backend" cmd /k "python backend\app.py"

:: Start the frontend
echo Starting frontend...
npm run dev

