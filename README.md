# PAGINAAUTO

Migración del proyecto **Pagina automatizacion** (FastAPI + `dashboard.html`) al stack:

- **Frontend:** Vite + React (`frontend/`)
- **Backend:** Node.js + Express (`backend/`)
- **Base de datos:** MySQL (WAMP)
- **Pipeline IA:** se reutiliza `main.py` (FastAPI) como servicio. Node hace proxy para endpoints de IA (`/report`, `/chat`, resolver ignorados).

```
HAM/
├─ Pagina automatizacion/    ← proyecto original (se mantiene para el pipeline IA)
│   └─ main.py               ← sigue siendo el pipeline Claude / GPT / Ollama
└─ PAGINAAUTO/               ← NUEVO
    ├─ backend/              Node API + MySQL
    └─ frontend/             Vite + React
```

---

## 1. Requisitos

- Node.js ≥ 20
- WAMP activo con MySQL (puerto 3306)
- Python + `main.py` corriendo en `http://localhost:8000` (es el que hace el trabajo IA)

## 2. Base de datos

Con WAMP encendido:

```bash
cd backend
cp .env.example .env       # ajusta credenciales si hace falta
npm install
npm run init-db            # crea DB "paginaauto" y tablas
```

Tablas creadas: `previews`, `notes`, `chat_messages` (ver `backend/schema.sql`).

## 3. Backend (API Node en :4000)

```bash
cd backend
npm run dev                # node --watch src/server.js
```

Endpoints principales (compatibles con `main.py`):

| Método | Ruta                         | Descripción                                     |
|--------|------------------------------|-------------------------------------------------|
| GET    | `/health`                    | Estado MySQL + Python                           |
| GET    | `/previews?status=pending`   | Lista previews (filtro por estado)              |
| GET    | `/previews/:id`              | Detalle completo                                |
| POST   | `/previews/:id/approve`      | Aplica el fix (escribe archivo + backup)        |
| POST   | `/previews/:id/reject`       | Marca rechazada                                 |
| POST   | `/previews/:id/resolve`      | Re-procesa una ignorada por el pipeline IA      |
| POST   | `/report`                    | Entra un error → Python → guarda preview en DB  |
| GET/POST/DELETE | `/notes[...]`       | Calendario                                      |
| GET    | `/summary/weekly`            | Agregados últimos 7 días                        |
| GET    | `/notifications`             | Urgentes pendientes                             |
| POST   | `/chat` · GET `/chat/history`| Chat proxied al pipeline Python, persistido     |

Los endpoints que requieren IA llaman a `PYTHON_API` (por defecto `http://localhost:8000`).

## 4. Frontend (Vite en :5173)

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173 . El dev server hace proxy de `/api/*` → `http://localhost:4000`.

Vistas migradas del `dashboard.html` original:

- **Ahora mismo** (live, refresh 5 s)
- **Bandeja** (pending)
- **Urgentes**
- **Calendario** con notas (CRUD)
- **Resumen semanal** (agregados desde MySQL)
- **Ignorados** (con botón "Resolver ahora")
- **Chat IAs** (historial persistido)
- **Configuración** (estado MySQL + Python)

## 5. Flujo end-to-end

```
PHP/JS error  ─▶  POST /report (Node)
                    ├─ proxy ─▶ main.py (Python: Ollama/Claude/GPT pipeline)
                    └─ guarda preview en MySQL
Frontend lista/aprueba ─▶ Node escribe archivo + backup en disco
```

## 6. Variables

`backend/.env`:

```
PORT=4000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=paginaauto
PYTHON_API=http://localhost:8000
PHP_CODE_ROOT=C:/wamp64/www/backendstore
JS_CODE_ROOT=C:/Users/Lenovo/Desktop/HAM/Pagina web
```

## 7. Pendiente / siguiente iteración

- SSE en `/resolve/stream` y `/chat/stream` (ahora solo síncrono).
- Migrar más prompts del pipeline de Python a Node si se quiere eliminar `main.py`.
- Autenticación (ahora abierta en localhost).
