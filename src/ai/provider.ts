import "server-only";

/**
 * Proveedor de IA intercambiable sobre el formato compatible con OpenAI.
 * Por defecto Google Gemini con clave gratuita (AI Studio). Alternativas: Groq, Ollama local, OpenAI.
 * La clave vive solo en el servidor (variables de entorno).
 */
const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

export type AiStatus = { configured: boolean; provider: string; model: string };

export function aiStatus(): AiStatus {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const preset = PRESETS[provider] ?? PRESETS.gemini;
  const configured = provider === "mock" || provider === "ollama" ? true : !!process.env.AI_API_KEY?.trim();
  return { configured, provider, model: process.env.AI_MODEL?.trim() || preset.model };
}

type Mock = (system: string, user: string) => unknown;
let mock: Mock | null = null;
/** Solo para pruebas automáticas. */
export function setMockProvider(fn: Mock | null) {
  mock = fn;
}

export class AiError extends Error {}

export async function chatJson<T = unknown>(system: string, user: string, opts: { temperature?: number } = {}): Promise<T> {
  const st = aiStatus();
  if (st.provider === "mock" || mock) {
    if (!mock) throw new AiError("Proveedor de prueba sin configurar.");
    return mock(system, user) as T;
  }
  if (!st.configured) throw new AiError("IA no configurada. Agrega AI_API_KEY (gratuita en aistudio.google.com).");
  const preset = PRESETS[st.provider] ?? PRESETS.gemini;
  const base = (process.env.AI_BASE_URL?.trim() || preset.baseUrl).replace(/\/$/, "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...(process.env.AI_API_KEY ? { authorization: `Bearer ${process.env.AI_API_KEY}` } : {}) },
      body: JSON.stringify({
        model: st.model,
        temperature: opts.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new AiError("Se alcanzó el límite gratuito del proveedor de IA. Intenta en un minuto.");
      if (res.status === 401 || res.status === 403) throw new AiError("La clave de IA no es válida.");
      throw new AiError(`El proveedor de IA respondió ${res.status}. ${body.slice(0, 160)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    return parseJson<T>(text);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if ((e as Error).name === "AbortError") throw new AiError("La IA tardó demasiado en responder.");
    throw new AiError("No fue posible conectar con el proveedor de IA (¿hay internet?).");
  } finally {
    clearTimeout(timer);
  }
}

export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new AiError("La IA devolvió una respuesta que no se pudo interpretar.");
  }
}
