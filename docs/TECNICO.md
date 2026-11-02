# Documentación técnica · v1.0.0

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS · Recharts · Lucide · Drizzle ORM · PostgreSQL (Neon en la nube, PGlite embebido en local) · Zod · jose · bcryptjs · ExcelJS · pdf-lib · Vercel Blob · Vitest.

## Capas

```
src/app/(auth)        configuración inicial y login
src/app/(app)         13 secciones (pantallas de servidor) + actions.ts / more-actions.ts / evidence-actions.ts
src/app/api/v1        REST: auth, dashboard, evidence/[id], reports, backup, cron, health
src/server/context.ts sesión + permiso + alcance (own/team/all) → Ctx
src/server/services   reglas de negocio; únicos que escriben en la base; cada escritura llama audit()
src/ai                proveedor intercambiable (formato OpenAI) y esquemas Zod de las respuestas
src/db                esquema Drizzle y cliente (Neon o PGlite según DATABASE_URL)
drizzle/              migraciones SQL versionadas
tests/                metrics, integration (fase 1), phases (fases 2–8)
scripts/              migrate (nube), seed-demo, run-demo, secret
```

## Modelo de datos (26 tablas)

Identidad: `role`, `permission`, `role_permission`, `member` (persona), `app_user` (cuenta).
Disponibilidad: `shift_definition`, `work_calendar`, `shift_assignment`, `time_off`.
Trabajo: `project`, `project_member`, `phase`, `routine_template`, `activity`, `activity_assignment`, `activity_dependency`, `checklist_item`, `time_entry`.
Soporte: `evidence`, `channel`, `comment`, `reminder`, `notification`, `audit_log`, `ai_proposal`, `setting`.

Reglas clave:
- `activity.origin` ∈ personal / habitual / extraordinaria; `project_id` opcional. Los indicadores filtran por ambos ejes sin mezclarlos.
- Una fila de `activity_assignment` por responsable, con estado, avance, inicio y fin reales y horas propios.
- «Vencida» se calcula: fecha límite pasada y estado abierto.
- Las personales siempre se asignan al administrador; las habituales se generan desde `routine_template` (idempotente por fecha).
- Borrado lógico (`deleted_at`) para proyectos, actividades y evidencias; la historia se conserva.

## Seguridad

- Contraseñas con bcrypt (12 rondas); bloqueo de 15 min tras 5 intentos fallidos.
- Sesión JWT HS256 de 12 h en cookie httpOnly (Secure en Vercel); en cada petición se verifica que el usuario siga activo.
- Middleware como primera barrera; permiso y alcance se verifican en el servidor en cada acción y consulta.
- Evidencias: lista blanca de extensiones, verificación de la firma real del archivo, nombre interno UUID, SHA-256, descarga con permiso y cabeceras `nosniff` y CSP.
- La clave de IA solo vive en el servidor. La IA nunca escribe: crea `ai_proposal` pendiente; al aprobar, los mismos servicios con permiso y auditoría ejecutan el cambio. Los IDs que devuelve la IA se validan contra la base.
- Respaldo JSON completo; la restauración exige escribir RESTAURAR y rechaza respaldos sin usuarios.

## Indicadores

Peso = horas estimadas × factor de prioridad × factor de complejidad (editables).
- Conclusión ponderada = Σ peso completadas ÷ Σ peso vigentes.
- Cumplimiento de fechas = completadas a tiempo ÷ completadas (zona America/Mexico_City).
- Eficiencia = Σ estimado ÷ Σ real (tope configurable, 200 %).
- Con menos de N completadas (3 por defecto) → «Información insuficiente».
- Proyecto: avance real vs. % de tiempo transcurrido; cierre proyectado = pendiente ponderado ÷ ritmo de los últimos 28 días.
- Carga: horas restantes con fecha en los próximos 5 días hábiles ÷ horas disponibles del turno asignado (día 12 h − 1 h, noche 8 h − 0.5 h, menos ausencias). Baja < 50 %, normal ≤ 85 %, alta ≤ 100 %, sobrecarga > 100 %.

## IA

`AI_PROVIDER` = gemini (por defecto, clave gratuita), groq, ollama u openai; todos por `/chat/completions` con salida JSON validada con Zod. Sin clave: desglose por reglas (verbos de diagnóstico, desarrollo y validación en días hábiles), intérprete de instrucciones (persona, hoy, mañana, prioridad) y plan del día por prioridad. El chat requiere clave.

## Recordatorios

`syncNotifications()` es idempotente (llave `dedupe_key`). Se ejecuta al abrir cualquier pantalla y, en Vercel, a diario con `/api/v1/cron` protegido por `CRON_SECRET`.

## Pruebas

`npm test` ejecuta 41 pruebas sobre PostgreSQL real en memoria. Cubren las fórmulas, la configuración inicial, turnos y disponibilidad, rutinas, asignación múltiple, dependencias y ciclos, evidencia obligatoria, reprogramación con historial, alerta de sobrecarga, la IA con aprobación (incluido que no aplica IDs inventados), validación de archivos, PDF y Excel, notificaciones sin duplicados, alcance por rol y respaldo con restauración.

## Siguiente fase sugerida

Acceso de colaboradores (`MULTIUSER_ENABLED=true`, pantallas «Mis actividades» con alcance `own`) y chat por proyecto sobre la tabla `channel` con WebSockets o polling.
