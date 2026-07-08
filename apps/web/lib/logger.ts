type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, string | number | boolean | null | undefined>;

function writeConsole(level: LogLevel, message: string, context: LogContext) {
  const payload = {
    level,
    message,
    service: "renaiss-atlas-web",
    ...context
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function logInfo(message: string, context: LogContext = {}) {
  writeConsole("info", message, context);
}

export function logWarn(message: string, context: LogContext = {}) {
  writeConsole("warn", message, context);
}

export function logError(message: string, context: LogContext = {}) {
  writeConsole("error", message, context);
}
