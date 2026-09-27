# Autostart — serviços sobem sozinhos depois de reiniciar o servidor

```bash
sudo bash ~/atendeflow/server-toolkit/autostart/instalar-autostart.sh
```

Deixa pronto para o próximo boot (não reinicia nada agora):

- **Docker** habilitado no boot.
- Serviço **`confianza-stack`**: espera rede, Docker e discos
  (`/srv/seafile-data`, `/mnt/nas-backup`, `/mnt/nas-seafile`) e roda
  `docker compose up -d --no-recreate` do **AtendeFlow** e do **Seafile** —
  liga inclusive container que tinha sido parado à mão (o
  `restart: unless-stopped` sozinho não faz isso) e nunca recria os que já
  existem. O Seafile só sobe se `/srv/seafile-data` estiver
  montado, para nunca rodar sem os arquivos.
- **cloudflared**, **pm2** (site) e **disk-monitor** habilitados, se existirem.
- Confere o `/etc/fstab` e avisa se um compartilhamento de rede está sem
  `nofail,x-systemd.automount` (sem isso o boot pode travar com o NAS fora).

Testar sem reiniciar:

```bash
sudo systemctl start confianza-stack && journalctl -u confianza-stack -n 30 --no-pager
```

Depois de reiniciar:

```bash
bash ~/atendeflow/server-toolkit/autostart/verificar-servicos.sh
```

O agente de IA do Instagram roda na Vercel e **não depende** deste servidor.
