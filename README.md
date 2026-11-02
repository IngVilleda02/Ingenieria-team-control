# Ingeniería Team Control

Centro de control para administrar tus proyectos, tus actividades personales y las de tus tres colaboradores. Distingue actividades **personales**, **habituales** y **extraordinarias**, mide cada tipo por separado, controla la carga de trabajo por turno, guarda evidencias y genera reportes. Incluye un asistente de IA que solo propone: nada se guarda sin tu aprobación.

**Versión 1.0.0 · las 8 fases terminadas · 41 pruebas automáticas aprobadas.**

---

## 1. Usarla en tu laptop Windows

1. Instala **Node.js LTS** (22 o superior) desde https://nodejs.org.
2. Descomprime la carpeta, por ejemplo en `Documentos\ingenieria-team-control`.
3. Doble clic en **`iniciar.bat`**. La primera vez instala y prepara todo, lo que tarda unos minutos.
4. Se abre `http://localhost:3000` → **Configuración inicial** → creas tu cuenta de administrador.
5. Ve a **Mi equipo → Registrar colaborador** y da de alta a tus tres colaboradores.

Tus datos quedan en la carpeta `data/` (PostgreSQL embebido, sin instalar nada). No cierres la ventana negra mientras uses la app.

**Para ver la demo con datos de ejemplo:** doble clic en `iniciar-demo.bat` → `http://localhost:3001`, usuario `demo@teamcontrol.local`, contraseña `Demo2026segura`. Usa una base aparte y no toca tus datos.

**Después de actualizar el código:** ejecuta `actualizar.bat`.

## 2. Desplegarla en Vercel

1. Sube la carpeta a un repositorio **privado** de GitHub. Las carpetas `data/`, `.env` y `node_modules/` no se suben (ya están en `.gitignore`).
2. En https://vercel.com → **Add New → Project** → importa el repositorio.
3. En el proyecto, ve a **Storage**:
   - **Create Database → Neon (Postgres)** → conéctala. Vercel crea `DATABASE_URL`.
   - **Create → Blob** → conéctalo. Vercel crea `BLOB_READ_WRITE_TOKEN` para las evidencias.
4. En **Settings → Environment Variables** agrega:
   - `AUTH_SECRET`: cadena aleatoria de 32 o más caracteres (`npx tsx scripts/secret.ts` la genera).
   - `CRON_SECRET`: otra cadena aleatoria, para los recordatorios automáticos diarios.
   - `AI_API_KEY`: opcional, clave gratuita de Gemini (https://aistudio.google.com → Get API key).
5. Haz clic en **Deploy**. El build aplica las migraciones solo. Abre la URL → Configuración inicial.

**Despliegue actual:** proyecto `ingenieria-team-control` en el equipo IngVilleda de Vercel, conectado al repositorio de GitHub. Cada `git push` a `main` vuelve a desplegar. Base Neon y Blob `ingenieria-evidencias` ya conectados.

**Ahorro de consumo en Neon (plan gratuito):** la base se suspende sola cuando no hay consultas. Para que eso pase más seguido, la app guarda la configuración y el estado de la sesión 60 s en memoria, revisa las alertas al navegar como máximo cada 15 minutos (y una vez al día con el cron), y genera las actividades habituales como máximo cada 6 horas. La pantalla Recordatorios siempre revisa al momento.

La base de la laptop y la de Vercel son independientes. Para pasar tus datos, descarga un respaldo en **Configuración** de la laptop y restáuralo en Vercel. En el plan gratuito de Vercel, cada evidencia puede pesar hasta 4 MB.

## 3. Variables de entorno

| Variable | Laptop | Vercel |
| --- | --- | --- |
| `DATABASE_URL` | vacía → `data/pglite` | la pone Neon |
| `AUTH_SECRET` | opcional (se crea en `data/auth-secret`) | **obligatoria** |
| `BLOB_READ_WRITE_TOKEN` | vacía → `data/evidence` | la pone Blob |
| `CRON_SECRET` | no aplica | recomendada |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | opcionales | opcionales |
| `MULTIUSER_ENABLED` | `false` | `false` hasta dar acceso al equipo |

En la laptop, copia `.env.example` como `.env.local` para cambiarlas.

## 4. Qué incluye

| Fase | Módulos |
| --- | --- |
| 1 | Base de datos completa, acceso seguro, menú de 13 secciones, dashboard con datos reales |
| 2 | Proyectos con dashboard y Gantt · actividades con lista, Kanban, checklist, subtareas, dependencias, horas, comentarios e historial · calendario · Mi día |
| 3 | Fichas de colaboradores · actividades habituales recurrentes · rotación de turnos y ausencias · «Asignar nueva actividad» a una o varias personas · planificación diaria |
| 4 | Indicadores ponderados (habitual y extraordinario por separado) · carga de trabajo con alerta antes de asignar · comparativas · proyección de cierre · configuración |
| 5 | Generador de actividades por fases · instrucciones en lenguaje natural · plan del día · asistente conversacional · todo con vista previa y aprobación |
| 6 | Repositorio de evidencias con validación de archivos · bitácora automática · reportes PDF y Excel |
| 7 | Recordatorios 24 h / 3 d / 7 d / fecha propia · notificaciones personales, de proyecto y de equipo |
| 8 | Roles y permisos en el servidor (admin, supervisor, colaborador) · cuentas de colaborador listas para activarse · respaldo y restauración |

**Pendiente a propósito (decisión de diseño):** el acceso de los colaboradores y el chat interno. El modelo de datos, los permisos y la tabla de canales ya existen. Para activar las cuentas basta `MULTIUSER_ENABLED=true`. El chat requiere una fase adicional.

## 5. Desarrollo

```bash
npm install
npm run dev          # http://localhost:3000 con recarga
npm test             # 41 pruebas (PostgreSQL real en memoria)
npm run typecheck
npm run db:generate  # tras cambiar src/db/schema.ts
npm run demo:seed    # regenera la base de demostración
```

Documentación técnica en `docs/TECNICO.md`; manual de usuario en `docs/MANUAL.md`.
