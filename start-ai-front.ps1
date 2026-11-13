# ============================================================
# Lancement combiné : AI Service (FastAPI) + Frontend (Vite)
# Le backend Spring Boot se lance depuis IntelliJ IDEA
# ============================================================

Write-Host "[1/2] Démarrage du service AI FastAPI sur le port 8090..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'AI Service FastAPI (:8090)'; cd '$PSScriptRoot\ai-service'; .\.venv\Scripts\uvicorn.exe main:app --port 8090 --reload"

Write-Host "[2/2] Démarrage du Frontend React (Vite) sur le port 5173..." -ForegroundColor Green
cd "$PSScriptRoot\frontend"
npm run dev
