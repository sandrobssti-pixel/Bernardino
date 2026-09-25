# Instalador por terminal do disk-monitor pra Windows.
# Rode como Administrador: botão direito no PowerShell -> "Executar como
# administrador", depois:
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   .\install.ps1
#
# Funciona nos dois cenários:
#   1. Rodado de dentro do pacote gerado por package-for-new-server.sh
#      (disk-monitor.exe já compilado) -> instala sem precisar de Node.js.
#   2. Rodado de dentro do checkout do repositório (sem o .exe ainda
#      gerado) -> avisa que precisa gerar o executável primeiro
#      (`npm run build:win` num Linux/Mac com Node, ou peça pra alguém
#      da equipe gerar - ver server-toolkit/disk-monitor/README.md).

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

Write-Host "=== Instalador do disk-monitor (Windows) ===" -ForegroundColor Cyan
Write-Host "Origem:  $ScriptDir"
Write-Host "Destino: $InstallDir"
Write-Host ""

$ExePath = Join-Path $ScriptDir "..\disk-monitor.exe"
if (-not (Test-Path $ExePath)) {
    Write-Error "disk-monitor.exe não encontrado em $ExePath. Gere o executável primeiro (npm run build:win, numa máquina com Node.js) ou use o pacote pronto de server-toolkit/dist/windows/."
    exit 1
}

if (-not (Test-Path (Join-Path $ScriptDir "winsw.exe"))) {
    Write-Error "winsw.exe não encontrado nesta pasta de instaladores. Baixe o WinSW (https://github.com/winsw/winsw/releases, arquivo WinSW-x64.exe) e coloque como 'winsw.exe' junto deste script antes de instalar — ver installers/windows/README.md."
    exit 1
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Path $ExePath -Destination (Join-Path $InstallDir "disk-monitor.exe") -Force
Copy-Item -Path (Join-Path $ScriptDir "..\public") -Destination $InstallDir -Recurse -Force
Copy-Item -Path (Join-Path $ScriptDir "winsw.exe") -Destination (Join-Path $InstallDir "disk-monitor-service.exe") -Force
Copy-Item -Path (Join-Path $ScriptDir "disk-monitor-service.xml") -Destination $InstallDir -Force

$envFile = Join-Path $InstallDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host ""
    Write-Host "--- Configuração inicial ---" -ForegroundColor Cyan
    $adminUser = Read-Host "Usuário administrador inicial [admin]"
    if ([string]::IsNullOrWhiteSpace($adminUser)) { $adminUser = "admin" }
    $securePassword = Read-Host "Senha do administrador inicial" -AsSecureString
    $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    )

    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $sessionSecret = [BitConverter]::ToString($bytes) -replace "-", ""

    @"
PORT=8091
SESSION_SECRET=$sessionSecret
DASHBOARD_USER=$adminUser
DASHBOARD_PASSWORD=$adminPassword
"@ | Set-Content -Path $envFile -Encoding UTF8

    Write-Host ".env criado em $envFile"
} else {
    Write-Host ".env já existe em $InstallDir — mantendo como está."
}

Write-Host ""
Write-Host "Instalando o serviço do Windows..." -ForegroundColor Cyan
Push-Location $InstallDir
try {
    & .\disk-monitor-service.exe install
    & .\disk-monitor-service.exe start
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== Instalado! ===" -ForegroundColor Green
Write-Host "Painel em: http://localhost:8091"
Write-Host "(lembre: nunca exponha essa porta direto na internet — use túnel/VPN)"
Write-Host ""
Write-Host "Ver/gerenciar o serviço: services.msc -> 'disk-monitor'"
Write-Host "Logs do serviço: $InstallDir\disk-monitor-service.wrapper.log (e .out.log / .err.log)"
