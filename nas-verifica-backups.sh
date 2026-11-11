#!/bin/bash
# Verificação dos backups feita DENTRO DO NAS (Synology), pelo Programador de tarefas do DSM.
#
# Por que existe: o monitor do servidor (monitor-backups.sh) não avisa se o PRÓPRIO servidor
# estiver desligado ou travado. Este roda no NAS, que continua ligado, e usa o e-mail do DSM
# (o mesmo que já avisa sobre o Programador de tarefas), sem guardar senha de e-mail em lugar nenhum.
#
# Como funciona: confere se existe backup novo (menos de MAX_HORAS) e de tamanho plausível em cada
# pasta compartilhada. Se faltar algum, imprime o relatório e TERMINA COM ERRO (código 1), e o DSM
# envia o e-mail ("Enviar detalhes de execução por e-mail ... somente quando terminar de forma
# anormal"). SOMENTE LEITURA: não apaga nem altera nada.
#
# Instalação: DSM > Painel de controle > Programador de tarefas > Criar > Tarefa agendada >
# Script definido pelo usuário; usuário root; diariamente às 07:00; colar este arquivo.
# Detalhes em docs/monitoramento-backups.md.

VOLUME="${VOLUME:-/volume1}"
MAX_HORAS="${MAX_HORAS:-26}"
PARCIAL_HORAS="${PARCIAL_HORAS:-3}"
LIVRE_MIN_GB="${LIVRE_MIN_GB:-20}"

FALHAS=0

# conferir "rotulo" "pasta" "padrao" "tamanho_minimo_em_KB"
conferir() {
  local rotulo="$1" pasta="$2" padrao="$3" min_kb="$4" achados minimo
  if [ "$min_kb" -ge 1024 ]; then minimo="$((min_kb / 1024)) MB"; else minimo="${min_kb} KB"; fi
  if [ ! -d "$pasta" ]; then
    echo "FALHA  $rotulo: pasta $pasta nao existe"
    FALHAS=$((FALHAS + 1)); return
  fi
  achados=$(find "$pasta" -maxdepth 1 -name "$padrao" -mmin "-$((MAX_HORAS * 60))" -size "+${min_kb}k" 2>/dev/null | wc -l)
  if [ "$achados" -ge 1 ]; then
    echo "OK     $rotulo"
  else
    echo "FALHA  $rotulo: nenhum arquivo '$padrao' com menos de ${MAX_HORAS}h e mais de ${minimo} em $pasta"
    FALHAS=$((FALHAS + 1))
  fi
}

parciais() {
  local rotulo="$1" pasta="$2" n
  [ -d "$pasta" ] || return
  n=$(find "$pasta" -maxdepth 1 -name '*.partial' -mmin "+$((PARCIAL_HORAS * 60))" 2>/dev/null | wc -l)
  if [ "$n" -ge 1 ]; then
    echo "FALHA  $rotulo: $n arquivo(s) .partial (backup interrompido) em $pasta"
    FALHAS=$((FALHAS + 1))
  fi
}

echo "Verificacao dos backups no NAS - $(date '+%d/%m/%Y %H:%M')"

conferir "AtendeFlow banco"      "$VOLUME/atendeflow-backup" 'db_*.sql.gz'            51200      # 50 MB
conferir "AtendeFlow arquivos"   "$VOLUME/atendeflow-backup" 'files_*.tar.gz'         10485760   # 10 GB
conferir "Seafile banco"         "$VOLUME/seafile-data"      'seafile_db_*.sql.gz'    500
conferir "Seafile arquivos"      "$VOLUME/seafile-data"      'seafile_files_*.tar.gz' 8388608    # 8 GB
conferir "Confianza (cifrado)"   "$VOLUME/confianza-backup"  'confianza-*.tar.gz.enc' 1024

parciais "AtendeFlow" "$VOLUME/atendeflow-backup"
parciais "Seafile"    "$VOLUME/seafile-data"

livre=$(df -k "$VOLUME" 2>/dev/null | awk 'NR==2{print int($4/1048576)}')
if [ -n "$livre" ] && [ "$livre" -lt "$LIVRE_MIN_GB" ]; then
  echo "FALHA  volume $VOLUME com so ${livre} GB livres (minimo ${LIVRE_MIN_GB} GB)"
  FALHAS=$((FALHAS + 1))
fi

if [ "$FALHAS" -eq 0 ]; then
  echo "Resultado: tudo em dia."
  exit 0
fi
echo "Resultado: $FALHAS problema(s). Verifique o servidor e os backups."
exit 1
