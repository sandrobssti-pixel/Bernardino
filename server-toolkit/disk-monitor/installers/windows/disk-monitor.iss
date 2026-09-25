; Instalador gráfico (assistente) do disk-monitor pra Windows — script
; fonte do Inno Setup (https://jrsoftware.org/isinfo.php, gratuito).
;
; ATENÇÃO: este .iss precisa ser COMPILADO numa máquina com o Inno Setup
; instalado (ou Wine) pra virar o DiskMonitorSetup.exe de verdade — não
; existe um jeito de gerar esse .exe a partir de um ambiente Linux sem
; Windows/Wine com Inno Setup. Ver installers/windows/README.md pro passo
; a passo completo (o que baixar, onde colocar os arquivos, como compilar).
;
; Esperado, ANTES de compilar, dentro desta mesma pasta (installers/windows/):
;   - winsw.exe (baixado à parte, ver README.md)
; E, na pasta pai (server-toolkit/disk-monitor/dist/windows/, gerada por
; npm run build:win ou package-for-new-server.sh):
;   - disk-monitor.exe
;   - public\ (pasta inteira)

#define MyAppName "Disk Monitor"
#define MyAppPublisher "Confiança Technologies"
#define MyAppVersion "1.4.0"
#define MyAppExeName "disk-monitor.exe"

[Setup]
AppId={{B4D8F5C2-6E1A-4B9A-9C3D-2F1A7E5D8C90}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\disk-monitor
DisableProgramGroupPage=yes
DefaultGroupName={#MyAppName}
OutputBaseFilename=DiskMonitorSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern
; SetupIconFile=disk-monitor.ico   ; descomente se adicionar um ícone .ico

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Executável e pasta public/ vêm do build (npm run build:win / package-for-new-server.sh)
Source: "..\dist\windows\disk-monitor.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\windows\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
; WinSW (baixado à parte — ver README.md) + config do serviço
Source: "winsw.exe"; DestDir: "{app}"; DestName: "disk-monitor-service.exe"; Flags: ignoreversion
Source: "disk-monitor-service.xml"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Abrir painel do Disk Monitor"; Filename: "http://localhost:8091"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\disk-monitor-service.exe"; Parameters: "install"; Flags: runhidden waituntilterminated; StatusMsg: "Instalando o serviço..."
Filename: "{app}\disk-monitor-service.exe"; Parameters: "start"; Flags: runhidden waituntilterminated; StatusMsg: "Iniciando o serviço..."
Filename: "http://localhost:8091"; Description: "Abrir o painel do Disk Monitor agora"; Flags: postinstall shellexec skipifsilent

[UninstallRun]
Filename: "{app}\disk-monitor-service.exe"; Parameters: "stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{app}\disk-monitor-service.exe"; Parameters: "uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "UninstallService"

[Code]
var
  AdminPage: TInputQueryPage;

procedure InitializeWizard;
begin
  AdminPage := CreateInputQueryPage(wpSelectDir,
    'Administrador inicial', 'Crie o primeiro usuário do painel',
    'Esse será o usuário administrador do painel do Disk Monitor. ' +
    'Depois de instalado, você pode criar mais usuários (inclusive só de ' +
    'visualização) pela própria tela "Usuários" do painel.');
  AdminPage.Add('Usuário:', False);
  AdminPage.Add('Senha:', True);
  AdminPage.Values[0] := 'admin';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = AdminPage.ID then
  begin
    if Trim(AdminPage.Values[0]) = '' then
    begin
      MsgBox('Preencha o nome do usuário administrador.', mbError, MB_OK);
      Result := False;
    end
    else if Length(AdminPage.Values[1]) < 6 then
    begin
      MsgBox('A senha precisa ter pelo menos 6 caracteres.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

// Gera uma chave aleatória (hex) pra assinar o cookie de sessão — cada
// instalação recebe a sua própria, nunca reaproveitada entre servidores.
function GenerateSessionSecret(): String;
var
  I: Integer;
  Hex: String;
begin
  Hex := '0123456789abcdef';
  Result := '';
  for I := 1 to 64 do
    Result := Result + Hex[Random(16) + 1];
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvPath: String;
  EnvContent: String;
begin
  if CurStep = ssPostInstall then
  begin
    EnvPath := ExpandConstant('{app}\.env');
    if not FileExists(EnvPath) then
    begin
      EnvContent :=
        'PORT=8091' + #13#10 +
        'SESSION_SECRET=' + GenerateSessionSecret() + #13#10 +
        'DASHBOARD_USER=' + AdminPage.Values[0] + #13#10 +
        'DASHBOARD_PASSWORD=' + AdminPage.Values[1] + #13#10;
      SaveStringToFile(EnvPath, EnvContent, False);
    end;
  end;
end;
