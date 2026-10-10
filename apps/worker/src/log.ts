/** Structured JSON logs. Never pass secrets, signed URLs, file contents or transcript text in here. */
export const log = {
  info: (msg: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ level: "info", time: new Date().toISOString(), msg, ...extra })),
  error: (msg: string, extra: Record<string, unknown> = {}) =>
    console.error(JSON.stringify({ level: "error", time: new Date().toISOString(), msg, ...extra })),
};
