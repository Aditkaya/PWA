# ============================================================
# deploy.ps1 - Script deploy PWA ke produksi
# Usage: .\deploy.ps1 "pesan commit anda"
# ============================================================

param(
    [string]$CommitMessage = "chore: update dan rebuild frontend"
)

Write-Host "==> [1/4] Build frontend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build gagal! Deploy dibatalkan." -ForegroundColor Red
    exit 1
}

Write-Host "==> [2/4] Menambahkan semua file ke git (termasuk dist)..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot"
git add -A
git add frontend/dist/ -f

Write-Host "==> [3/4] Commit: '$CommitMessage'" -ForegroundColor Cyan
git commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "INFO: Tidak ada perubahan untuk di-commit, atau commit gagal." -ForegroundColor Yellow
}

Write-Host "==> [4/4] Push ke origin main..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Push gagal!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deployment selesai!" -ForegroundColor Green
