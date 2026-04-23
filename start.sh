#!/bin/bash
# Levanta el frontend del Generador de Informes — Prospecta
set -e

cd /home/dockeradmin/frontend

# Matar proceso previo si existe
pkill -f "python3 proxy.py" 2>/dev/null && echo "Proceso previo detenido" || true

sleep 1

# Iniciar (credenciales Nextcloud para galería de informes)
NEXTCLOUD_USER="${NEXTCLOUD_USER:-prospecta}" \
NEXTCLOUD_PASS="${NEXTCLOUD_PASS:-L9Qwd-EmpXR-FW6Sn-zgfKM-bE7ox}" \
nohup python3 proxy.py > proxy.log 2>&1 &
PID=$!

sleep 1

if kill -0 $PID 2>/dev/null; then
  echo "Frontend iniciado (PID $PID)"
  echo "URL: http://10.58.114.31:8090"
else
  echo "ERROR: el proceso no quedó corriendo. Revisa proxy.log"
  cat proxy.log
  exit 1
fi
