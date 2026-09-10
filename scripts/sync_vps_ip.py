#!/usr/bin/env python3
"""
Sincronización automática de IP pública dinámica con el Firewall de Hostinger para VPS Psiconex.
"""

import os
import sys
import json
import time
import subprocess
import urllib.request
import urllib.error

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
HOSTINGER_API_BASE = "https://developers.hostinger.com/api/vps/v1"

def load_env(env_path):
    config = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    config[key.strip()] = val.strip().strip("'\"")
    return config

def get_public_ip():
    services = [
        "https://api.ipify.org",
        "https://icanhazip.com",
        "https://ifconfig.me/ip",
        "https://checkip.amazonaws.com"
    ]
    for url in services:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=5) as resp:
                ip = resp.read().decode().strip()
                if ip and len(ip.split(".")) == 4:
                    return ip
        except Exception:
            continue
    raise RuntimeError("No fue posible detectar la IP pública actual.")

def test_ssh(host="psiconex-vps", timeout=4):
    cmd = ["ssh", "-o", f"ConnectTimeout={timeout}", "-o", "BatchMode=yes", host, "echo SSH_OK"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 2)
        return res.returncode == 0 and "SSH_OK" in res.stdout
    except Exception:
        return False

def hostinger_request(endpoint, token, method="GET", data=None):
    url = f"{HOSTINGER_API_BASE}{endpoint}" if endpoint.startswith("/") else f"{HOSTINGER_API_BASE}/{endpoint}"
    payload = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
    }
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8") if e.fp else str(e)
        raise RuntimeError(f"Error Hostinger API {e.code}: {err_msg}")
    except Exception as e:
        raise RuntimeError(f"Falla de conexión con Hostinger API: {e}")

def sync_firewall_ip(force=False):
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_file = os.path.join(root_dir, ".env.hostinger")
    env = load_env(env_file)

    token = env.get("HOSTINGER_API_TOKEN") or os.environ.get("HOSTINGER_API_TOKEN")
    vm_id = env.get("HOSTINGER_VM_ID", "1134588")

    print("[1/4] Verificando IP pública actual...")
    current_ip = get_public_ip()
    print(f"      IP Pública detectada: {current_ip}")

    if not force:
        print("[2/4] Comprobando acceso SSH a psiconex-vps...")
        if test_ssh():
            print(f"[OK] Acceso SSH operativo desde {current_ip}. No es necesario modificar el firewall.")
            return True
        print("      Conexión SSH bloqueada o con timeout. Procediendo a autorizar IP en Hostinger...")
    else:
        print("[2/4] Forzando sincronización de regla de firewall...")

    if not token or token == "YOUR_TOKEN_HERE":
        print("[ERROR] Falta HOSTINGER_API_TOKEN en .env.hostinger.")
        sys.exit(1)

    print("[3/4] Obteniendo firewall asignado a la máquina virtual...")
    vm_data = hostinger_request(f"/virtual-machines/{vm_id}", token)
    fw_id = vm_data.get("firewall_group_id") or 143780
    print(f"      Firewall Group ID: {fw_id}")

    fw_detail = hostinger_request(f"/firewall/{fw_id}", token)
    rules = fw_detail.get("rules", [])
    print(f"      Reglas activas encontradas: {len(rules)}")

    ip_found = False
    for r in rules:
        src = r.get("source_detail") or r.get("source")
        port = str(r.get("port", ""))
        proto = str(r.get("protocol", "")).upper()
        if src == current_ip and (port == "22" or proto in ["SSH", "TCP"]):
            ip_found = True
            break

    if ip_found:
        print(f"      La IP {current_ip} ya existe en las reglas de Hostinger. Sincronizando...")
    else:
        print(f"      Añadiendo regla SSH para {current_ip} en Hostinger...")
        rule_payload = {
            "protocol": "SSH",
            "port": "22",
            "source": "custom",
            "source_detail": current_ip,
            "action": "accept"
        }
        hostinger_request(f"/firewall/{fw_id}/rules", token, method="POST", data=rule_payload)
        print("      [OK] Regla añadida exitosamente en Hostinger.")

    print(f"      Sincronizando firewall con el servidor...")
    hostinger_request(f"/firewall/{fw_id}/sync", token, method="POST")
    print("      [OK] Solicitud de sincronización aceptada por Hostinger.")

    print("[4/4] Esperando propagación de reglas (6 segundos)...")
    time.sleep(6)

    print("      Verificando conexión SSH...")
    for attempt in range(1, 4):
        if test_ssh(timeout=5):
            print(f"[EXITO] Conexión SSH establecida correctamente con la IP {current_ip}.")
            return True
        print(f"      Intento {attempt}/3 esperando respuesta de SSH...")
        time.sleep(3)

    print("[AVISO] Hostinger ya tiene autorizada tu IP, pero el firewall interno (ufw) del VPS aún no la permite.")
    print("        Asegúrate de ejecutar una sola vez en la consola web de KVM 2: sudo ufw allow 22/tcp")
    return False

if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    try:
        success = sync_firewall_ip(force=force_flag)
        sys.exit(0 if success else 1)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
