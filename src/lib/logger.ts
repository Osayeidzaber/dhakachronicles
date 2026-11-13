/** Structured JSON logger (works in Vercel logs). Never pass secrets in `data`. */
type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, msg: string, data?: Record<string, unknown>) {
  const entry = { level, msg, time: new Date().toISOString(), ...data };
  const line = JSON.stringify(entry, (_k, v: unknown) =>
    v instanceof Error ? { name: v.name, message: v.message } : v,
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level !== "debug" || process.env.NODE_ENV !== "production") console.log(line);
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>) => write("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => write("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => write("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};
