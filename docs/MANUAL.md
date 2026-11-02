# Manual de usuario · Ingeniería Team Control

## Primer uso

1. Abre la app y crea tu cuenta en **Configuración inicial**.
2. En **Configuración**, revisa el horario de los turnos (día 12 h, noche 8 h), los días laborables y los factores de ponderación.
3. En **Mi equipo → Registrar colaborador**, da de alta a tus tres colaboradores con su puesto, especialidad y responsabilidades.
4. En el perfil de cada uno, agrega sus **actividades habituales** (diarias, semanales o mensuales). El sistema crea cada instancia sola.
5. En **Mi equipo → Rotación de turnos**, genera la rotación semanal día/noche de cada persona.

## Los tres tipos de actividad

| Tipo | Quién la hace | Para qué se mide |
| --- | --- | --- |
| Personal | Tú | Tu propio avance (Mi día) |
| Habitual | Un colaborador, como parte de su puesto | Cumplimiento habitual |
| Extraordinaria | Un colaborador, como trabajo adicional que tú asignas | Cumplimiento extraordinario, por separado |

Cualquiera de las tres puede pertenecer a un proyecto; entonces cuenta también en el avance del proyecto.

## Tareas frecuentes

- **Asignar trabajo:** Asignaciones → **Asignar nueva actividad**. Si la persona queda en carga alta o sobrecarga, verás la advertencia y podrás confirmar o ajustar.
- **Ver qué hace cada quien hoy:** Asignaciones (planificación diaria). Filtra por persona, proyecto, prioridad, estado o tipo, y reprograma en la misma tabla.
- **Actualizar avance:** abre la actividad → bloque del responsable → estado, % y horas. También puedes arrastrar la tarjeta en Kanban.
- **Reprogramar:** en la actividad, en la planificación diaria o en una propuesta del asistente. Cada cambio queda en el historial.
- **Evidencias:** sube fotos, PDF, Excel, Word o archivos de PLC y robot desde la actividad, el proyecto o Evidencias. Si marcas «Requiere evidencia», la actividad no se puede completar sin ella.
- **Organizar tu día:** Mi día → escribe lo que necesitas hacer → **Proponer horario** → acepta, quita bloques o rechaza.
- **Crear un proyecto con IA:** Asistente IA → Generar actividades → describe el trabajo → revisa fases, responsables, fechas y horas → **Aprobar y crear**.
- **Instrucción rápida:** «Agrega una actividad para revisar el sensor de presencia y asígnasela a Juan para mañana» → se abre el formulario prellenado para que confirmes.
- **Preguntar:** Asistente IA → Preguntar (requiere clave de IA). Las respuestas marcan qué es **Registrado**, **Estimado** o **Recomendación**.
- **Reportes:** Reportes → general, individual o por proyecto → periodo → PDF o Excel.
- **Recordatorios:** Recordatorios → aviso 24 h, 3 días, 7 días o fecha propia. La campana del menú muestra los pendientes.
- **Respaldo:** Configuración → **Descargar respaldo completo**. Guárdalo fuera de la laptop una vez por semana.

## Cómo leer los indicadores

- Los porcentajes están **ponderados**: una actividad crítica de 8 h pesa más que varias tareas pequeñas.
- Compara siempre el porcentaje con el **volumen ponderado** y la **complejidad media** de la tabla comparativa.
- «Información insuficiente» significa que aún no hay al menos 3 actividades completadas para calcularlo.
- Los indicadores describen el trabajo registrado; no son una calificación de la persona.

## Activar la IA gratis

1. Entra a https://aistudio.google.com con una cuenta de Google → **Get API key**.
2. En la laptop, crea `.env.local` con `AI_API_KEY=tu_clave`; en Vercel, agrégala en Environment Variables.
3. Reinicia la app. En Asistente IA verás «IA activa · gemini».

Antes de usarla con información de la planta, confirma con TI que la política de la empresa permite enviar descripciones de actividades a un servicio externo. Sin clave, la app sigue funcionando en modo básico.
