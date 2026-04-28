from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import httpx
import os

app = FastAPI()

# Configuración de rutas estáticas y templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# URLs rescatadas de tu proxy.py
N8N_WEBHOOK = "http://10.58.114.31:5678/webhook/generar-informe"
N8N_CHAT_WEBHOOK = "http://10.58.114.31:5678/webhook/chat-prospecta/chat"

@app.get("/", response_class=HTMLResponse)
async def read_wizard(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="wizard.html"
    )

# --- ENDPOINTS ADAPTADOS DEL PROXY.PY ---

@app.post("/api/v2/auth/login")
async def login_proxy(request: Request):
    """
    Simula el login. En tu arquitectura actual, n8n suele validar 
    o simplemente registrar el inicio de sesión.
    """
    data = await request.json()
    # Aquí puedes añadir lógica de validación local si lo deseas
    return {"status": "success", "message": "Autenticación aceptada"}

@app.post("/api/generar")
async def generar_informe_proxy(request: Request):
    """Reenvía la solicitud de generación al webhook de n8n."""
    body = await request.json()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(N8N_WEBHOOK, json=body, timeout=30.0)
            return response.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Error conectando con n8n: {str(e)}")

@app.post("/api/chat")
async def chat_proxy(request: Request):
    """Reenvía la consulta del chat al webhook de n8n."""
    body = await request.json()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(N8N_CHAT_WEBHOOK, json=body, timeout=120.0)
            return response.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Error en el chat de n8n: {str(e)}")

# Healthcheck para el servidor
@app.get("/health")
async def health():
    return {"ok": True}