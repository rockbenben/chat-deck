Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
    Write-Host "First run - installing dependencies..."
    npm install
}

Write-Host ""
Write-Host "ChatDeck"
Write-Host "  http://localhost:3456"
Write-Host ""

npm run dev
