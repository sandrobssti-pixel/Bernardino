# Atualiza uma instalação já existente do disk-monitor no Windows — um
# único comando, sem pedir usuário/senha de novo e sem mexer no .env.
#
# Diferença pro install.ps1: aquele instala do zero (registra o serviço,
# pede admin inicial); este só troca o executável e a pasta public/ de uma
# instalação que já está rodando. Se $InstallDir ainda não existir, ou não
# tiver um .env, use o install.ps1 em vez deste.
#
# Rode como Administrador, de dentro da pasta com o disk-monitor.exe NOVO
# (gerado por npm run build:win ou baixado atualizado):
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   .\update.ps1

param(
    [string]$InstallDir = "C:\disk-monitor"
)

$ErrorActionPreference = "Stop"

function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Error "Rode este script como Administrador (botão direito no PowerShell -> Executar como administrador)."
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$envFile = Join-Path $InstallDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Error "Não achei uma instalação em $InstallDir (sem .env). Essa pasta ainda não foi instalada — use o install.ps1, não o update.ps1."
    exit 1
}

$ExePath = Join-Path $ScriptDir "..\disk-monitor.exe"
if (-not (Test-Path $ExePath)) {
    Write-Error "disk-monitor.exe não encontrado em $ExePath. Gere o executável atualizado primeiro (npm run build:win) ou use o pacote pronto de server-toolkit/dist/windows/."
    exit 1
}

Write-Host "=== Atualizador do disk-monitor (Windows) ===" -ForegroundColor Cyan
Write-Host "Origem:  $ScriptDir"
Write-Host "Destino: $InstallDir"
Write-Host ""

$serviceExe = Join-Path $InstallDir "disk-monitor-service.exe"

Write-Host "Parando o serviço..." -ForegroundColor Cyan
Push-Location $InstallDir
try {
    & .\disk-monitor-service.exe stop
} finally {
    Pop-Location
}

Write-Host "Copiando os arquivos novos..."
Copy-Item -Path $ExePath -Destination (Join-Path $InstallDir "disk-monitor.exe") -Force
Remove-Item -Path (Join-Path $InstallDir "public") -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $ScriptDir "..\public") -Destination $InstallDir -Recurse -Force

Write-Host "Reiniciando o serviço..." -ForegroundColor Cyan
Push-Location $InstallDir
try {
    & .\disk-monitor-service.exe start
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== Atualizado! ===" -ForegroundColor Green
Write-Host "Confira a versão no canto superior do painel (http://localhost:8091) ou em:"
Write-Host "$InstallDir\disk-monitor-service.wrapper.log"
