#!/usr/bin/env python3
"""
Proxy frontend para Generador de Informes — Prospecta.
Sirve form.html y reenvía solicitudes al webhook de n8n.
"""
import json
import os
import pathlib
import time
import urllib.request
import urllib.error
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", 9000))
N8N_WEBHOOK = "http://10.58.114.31:5678/webhook/generar-informe"
N8N_CHAT_WEBHOOK = "http://10.58.114.31:5678/webhook/chat-prospecta/chat"
BACKEND_URL = os.environ.get("BACKEND_URL", "http://10.58.114.33:8093")
BASE_DIR = pathlib.Path(__file__).parent

# Cache para /api/informes — evita llamadas repetidas a Nextcloud (429)
_informes_cache = {"data": None, "ts": 0}
_INFORMES_TTL = 8  # segundos


class Handler(BaseHTTPRequestHandler):

    def do_GET(self):
        # Matchers exactos ignoran query string (?next=..., ?foo=bar)
        path = self.path.split("?", 1)[0]
        if self.path.startswith('/api/v4/'):
            backend_path = self.path.replace('/api/v4/', '/api/', 1)
            self._proxy_backend(backend_path)
            return
        if self.path.startswith('/api/v2/'):
            # Alias temporal: consumidores antiguos pasan al mismo backend v4.
            backend_path = self.path.replace('/api/v2/', '/api/', 1)
            self._proxy_backend(backend_path)
            return
        # Rutas v5 — un HTML por ruta
        if path in ("/", "/index.html", "/landing"):
            self._serve_file("v5/landing.html", "text/html; charset=utf-8")
            return
        if path == "/login":
            self._serve_file("v5/login.html", "text/html; charset=utf-8")
            return
        if path == "/generar":
            self._serve_file("v5/workbench.html", "text/html; charset=utf-8")
            return
        if path == "/tecnologia":
            self._serve_file("v5/tecnologia.html", "text/html; charset=utf-8")
            return
        # Rutas legacy preservadas
        if path == "/v4":
            self._serve_file("form_v4.html", "text/html; charset=utf-8")
            return
        if self.path.startswith("/v5/"):
            self._serve_v5_asset(self.path[len("/v5/"):])
            return
        if path == "/v2":
            self.send_response(301)
            self.send_header("Location", "/v4")
            self.end_headers()
            return
        if path == "/health":
            self._json(200, {"ok": True})
            return
        if self.path.startswith("/api/informes"):
            self._handle_list_informes()
            return
        if self.path.startswith("/api/download"):
            self._handle_download()
            return
        if path == "/grafo":
            self._serve_file("grafo.html", "text/html; charset=utf-8")
            return
        if path == "/api/grafo":
            self._serve_file("grafo_data.json", "application/json; charset=utf-8")
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path.startswith('/api/v4/'):
            backend_path = self.path.replace('/api/v4/', '/api/', 1)
            self._proxy_backend(backend_path)
            return
        if self.path.startswith('/api/v2/'):
            # Alias temporal: consumidores antiguos pasan al mismo backend v4.
            backend_path = self.path.replace('/api/v2/', '/api/', 1)
            self._proxy_backend(backend_path)
            return
        if self.path == "/api/generar":
            self._handle_generar()
        elif self.path == "/api/chat":
            self._handle_chat()
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    # ------------------------------------------------------------------ #

    def _proxy_backend(self, path):
        """Forward request to FastAPI backend on .33."""
        target = f"{BACKEND_URL}{path}"
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len) if content_len else None

        req = urllib.request.Request(
            target,
            data=body,
            headers={
                'Content-Type': self.headers.get('Content-Type', 'application/json'),
                'Authorization': self.headers.get('Authorization', ''),
            },
            method=self.command,
        )
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self._json(502, {"error": str(e)})

    def _serve_file(self, filename, content_type):
        filepath = BASE_DIR / filename
        if not filepath.exists():
            self.send_response(404)
            self.end_headers()
            return
        content = filepath.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _serve_v5_asset(self, relpath):
        """Sirve archivos estáticos bajo frontend/v5/, con path traversal check."""
        v5_dir = (BASE_DIR / "v5").resolve()
        try:
            target = (v5_dir / relpath).resolve()
        except Exception:
            self.send_response(400)
            self.end_headers()
            return
        if v5_dir not in target.parents and target != v5_dir:
            self.send_response(403)
            self.end_headers()
            return
        if not target.exists() or not target.is_file():
            self.send_response(404)
            self.end_headers()
            return
        ext = target.suffix.lower()
        mime = {
            ".html": "text/html; charset=utf-8",
            ".css":  "text/css; charset=utf-8",
            ".js":   "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg":  "image/svg+xml",
            ".png":  "image/png",
            ".jpg":  "image/jpeg",
            ".jpeg": "image/jpeg",
            ".ico":  "image/x-icon",
            ".woff": "font/woff",
            ".woff2":"font/woff2",
        }.get(ext, "application/octet-stream")
        content = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _handle_generar(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            req = urllib.request.Request(
                N8N_WEBHOOK,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                response_body = resp.read()
                status = resp.status
        except urllib.error.HTTPError as e:
            response_body = json.dumps({"error": f"n8n error {e.code}"}).encode()
            status = 502
        except Exception as e:
            response_body = json.dumps({"error": str(e)}).encode()
            status = 502

        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(response_body)

    def _handle_chat(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        t0 = time.monotonic()

        try:
            req = urllib.request.Request(
                N8N_CHAT_WEBHOOK,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                response_body = resp.read()
                status = resp.status
        except urllib.error.HTTPError as e:
            response_body = json.dumps({"error": f"n8n error {e.code}"}).encode()
            status = 502
        except Exception as e:
            response_body = json.dumps({"error": str(e)}).encode()
            status = 502

        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(response_body)

        try:
            latency_ms = int((time.monotonic() - t0) * 1000)
            data = json.loads(body.decode("utf-8", errors="replace"))
            log_entry = json.dumps({
                "ts": datetime.utcnow().isoformat(),
                "session": str(data.get("sessionId", ""))[:40],
                "q": str(data.get("chatInput", ""))[:200],
                "ms": latency_ms,
            }, ensure_ascii=False)
            log_path = BASE_DIR / "chat_queries.log"
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(log_entry + "\n")
        except Exception:
            pass

    def _handle_download(self):
        """Descarga un PDF desde Nextcloud y lo sirve al browser."""
        import base64
        from urllib.parse import urlparse, parse_qs, quote
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        nombre = params.get("nombre", [None])[0]
        if not nombre or not nombre.lower().endswith(".pdf"):
            self.send_response(400)
            self.end_headers()
            return

        nc_url  = os.environ.get("NEXTCLOUD_URL",  "http://10.58.114.31:18080")
        nc_user = os.environ.get("NEXTCLOUD_USER", "prospecta")
        nc_pass = os.environ.get("NEXTCLOUD_PASS", "")
        credentials = base64.b64encode(f"{nc_user}:{nc_pass}".encode()).decode()

        dav_url = f"{nc_url}/remote.php/dav/files/{nc_user}/informes/{quote(nombre)}"
        try:
            req = urllib.request.Request(
                dav_url,
                headers={"Authorization": f"Basic {credentials}"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                pdf_data = resp.read()
        except Exception as e:
            self._json(502, {"error": str(e)})
            return

        safe_name = nombre.replace('"', '')
        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf_data)))
        self.send_header("Content-Disposition", f'attachment; filename="{safe_name}"')
        self.end_headers()
        self.wfile.write(pdf_data)

    def _handle_list_informes(self):
        """Lista PDFs en Nextcloud /informes/ via WebDAV PROPFIND."""
        global _informes_cache
        now = time.time()
        if _informes_cache["data"] is not None and now - _informes_cache["ts"] < _INFORMES_TTL:
            self._json(200, _informes_cache["data"])
            return

        import base64
        import re as _re
        nc_url  = os.environ.get("NEXTCLOUD_URL",  "http://10.58.114.31:18080")
        nc_user = os.environ.get("NEXTCLOUD_USER", "prospecta")
        nc_pass = os.environ.get("NEXTCLOUD_PASS", "")

        dav_url = f"{nc_url}/remote.php/dav/files/{nc_user}/informes/"
        credentials = base64.b64encode(f"{nc_user}:{nc_pass}".encode()).decode()

        propfind_body = b'''<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:displayname/><d:getlastmodified/><d:getcontentlength/></d:prop>
</d:propfind>'''

        try:
            req = urllib.request.Request(
                dav_url, data=propfind_body, method="PROPFIND",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Depth": "1",
                    "Content-Type": "application/xml"
                }
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                xml_data = resp.read().decode("utf-8")

            # Parsear por bloque <d:response> para evitar desalineamiento de índices
            # (la carpeta raíz también tiene getlastmodified pero no es PDF)
            informes = []
            for block in _re.findall(r'<d:response>(.*?)</d:response>', xml_data, _re.DOTALL | _re.IGNORECASE):
                href_m = _re.search(r'<d:href>([^<]+\.pdf)</d:href>', block, _re.IGNORECASE)
                if not href_m:
                    continue
                name = href_m.group(1).split("/")[-1]
                date_m = _re.search(r'<d:getlastmodified>([^<]+)</d:getlastmodified>', block)
                size_m = _re.search(r'<d:getcontentlength>([^<]+)</d:getcontentlength>', block)
                informes.append({
                    "nombre": name,
                    "fecha": date_m.group(1) if date_m else "",
                    "tamano": int(size_m.group(1)) if size_m else 0,
                    "url": f"{nc_url}/index.php/apps/files/?dir=/informes&openfile={name}"
                })

            from email.utils import parsedate_tz, mktime_tz
            def _parse_ts(s):
                try: return mktime_tz(parsedate_tz(s))
                except Exception: return 0
            informes.sort(key=lambda x: _parse_ts(x["fecha"]), reverse=True)
            result = {"informes": informes[:6]}
            _informes_cache["data"] = result
            _informes_cache["ts"] = now
            self._json(200, result)
        except Exception as e:
            # Si hay cache (aunque sea stale), preferirlo sobre devolver lista vacía
            if _informes_cache["data"] is not None:
                self._json(200, _informes_cache["data"])
            else:
                self._json(200, {"informes": [], "error": str(e)})

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        origin = self.headers.get("Origin", "")
        allowed = f"http://10.58.114.31:{PORT}"
        if origin == allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def log_message(self, fmt, *args):
        import sys, datetime
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{ts}] {fmt % args}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Frontend disponible en http://10.58.114.31:{PORT}", flush=True)
    server.serve_forever()
