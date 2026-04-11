type LogContext = Record<string, unknown>;
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const service = "orders";
const runtime = process.env.NODE_ENV ?? "development";
const version = process.env.APP_VERSION ?? "unknown";
const hostname = process.env.HOSTNAME ?? "unknown";

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40
};

const configuredLevel = normalizeLevel(process.env.LOG_LEVEL);
const minLevel = LOG_LEVELS[configuredLevel];
const redactedKeys = new Set(
  (process.env.LOG_REDACT_KEYS ??
    "password,token,authorization,cookie,secret,api_key,apikey")
    .split(",")
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean)
);

export function logEvent(
  event: string,
  context: LogContext = {},
  level: LogLevel = "INFO"
): void {
  log(level, event, context);
}

export function logError(
  event: string,
  error: unknown,
  context: LogContext = {}
): void {
  log("ERROR", event, {
    ...context,
    error: serializeError(error)
  });
}

function log(level: LogLevel, event: string, context: LogContext): void {
  if (LOG_LEVELS[level] < minLevel) {
    return;
  }

  const sanitizedContext = redact(context) as LogContext;
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service,
    runtime,
    version,
    hostname,
    event,
    ...sanitizedContext
  };

  const serialized = JSON.stringify(payload);

  if (level === "ERROR") {
    console.error(serialized);
    return;
  }

  if (level === "WARN") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

function normalizeLevel(value: string | undefined): LogLevel {
  const upper = value?.toUpperCase();
  if (upper === "DEBUG" || upper === "INFO" || upper === "WARN" || upper === "ERROR") {
    return upper;
  }
  return "INFO";
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(isObjectLike(error) ? sanitizeErrorProps(error) : {})
    };
  }

  return {
    message: typeof error === "string" ? error : "unknown_error"
  };
}

function sanitizeErrorProps(error: Error): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const source = error as unknown as Record<string, unknown>;
  for (const key of ["code", "errno", "syscall", "hostname", "detail"]) {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (!isObjectLike(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (redactedKeys.has(key.toLowerCase())) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = redact(entry);
  }

  return output;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
