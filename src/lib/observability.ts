type LogFields = Record<string, string | number | boolean | null | undefined>;

function write(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const payload = { timestamp: new Date().toISOString(), level, event, ...fields };
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(JSON.stringify(payload));
}

export const telemetry = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
  measure<T>(event: string, operation: () => Promise<T>, fields?: LogFields) {
    const started = performance.now();
    return operation().finally(() => write("info", event, { ...fields, durationMs: Math.round(performance.now() - started) }));
  },
};
