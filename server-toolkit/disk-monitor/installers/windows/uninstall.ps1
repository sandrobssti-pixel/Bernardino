# Desinstala o serviço do disk-monitor no Windows. Rode como
# Administrador, de dentro da pasta onde foi instalado (padrão
# C:\disk-monitor), ou passe o caminho:
#   .\uninstall.ps1 -InstallDir "C:\disk-monitor"
#
# Não apaga o .env nem a pasta data\ por padrão — passe -RemoveData pra
# apagar tudo, inclusive o histórico e os usuários cadastrados.

param(
    [string]$InstallDir = "C:\disk-monitor",
    [switch]$RemoveData
)

$ErrorActionPreference = "Stop"

function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Error "Rode como Administrador."
    exit 1
}

$serviceExe = Join-Path $InstallDir "disk-monitor-service.exe"
if (Test-Path $serviceExe) {
    Push-Location $InstallDir
    try {
        & .\disk-monitor-service.exe stop
        & .\disk-monitor-service.exe uninstall
    } finally {
        Pop-Location
    }
    Write-Host "Serviço removido."
} else {
    Write-Warning "Serviço não encontrado em $InstallDir — talvez já tenha sido removido."
}

if ($RemoveData) {
    Remove-Item -Path $InstallDir -Recurse -Force
    Write-Host "Pasta $InstallDir removida (incluindo .env e data\)."
} else {
    Write-Host "Arquivos mantidos em $InstallDir (.env e data\ preservados). Use -RemoveData pra apagar tudo."
}
