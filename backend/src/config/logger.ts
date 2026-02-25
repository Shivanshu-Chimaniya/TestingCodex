import { AsyncLocalStorage } from 'node:async_hooks';

export type LogLevel = 'info' | 'warn' | 'error';

export type RequestLogContext = {
  requestId?: string;
  roomId?: string;
  userId?: string;
};

type AlertName = 'error_rate_spike' | 'socket_disconnect_storm' | 'ai_validation_failures';

const requestContextStore = new AsyncLocalStorage<RequestLogContext>();

const alertState: Record<AlertName, number[]> = {
  error_rate_spike: [],
  socket_disconnect_storm: [],
  ai_validation_failures: [],
};

function nowIso() {
  return new Date().toISOString();
}

function payloadToObject(payload: unknown): Record<string, unknown> {
  if (!payload) return {};
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return { payload };
}

function jsonLog(stream: 'app' | 'security_audit', level: LogLevel, message: string, payload?: unknown) {
  const context = requestContextStore.getStore() ?? {};
  const line = {
    timestamp: nowIso(),
    level,
    stream,
    message,
    ...context,
    ...payloadToObject(payload),
  };
  const serialized = JSON.stringify(line);

  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

function trackAlert(name: AlertName, threshold: number, windowMs: number) {
  const now = Date.now();
  const list = alertState[name].filter((value) => now - value <= windowMs);
  list.push(now);
  alertState[name] = list;

  if (list.length >= threshold) {
    jsonLog('security_audit', 'warn', `alert.${name}`, {
      count: list.length,
      windowMs,
      threshold,
    });
    alertState[name] = [];
  }
}

export const logger = {
  withContext<T>(context: RequestLogContext, fn: () => T): T {
    const current = requestContextStore.getStore() ?? {};
    return requestContextStore.run({ ...current, ...context }, fn);
  },
  setContext(context: RequestLogContext) {
    const current = requestContextStore.getStore() ?? {};
    requestContextStore.enterWith({ ...current, ...context });
  },
  info(message: string, payload?: unknown) {
    jsonLog('app', 'info', message, payload);
  },
  warn(message: string, payload?: unknown) {
    jsonLog('app', 'warn', message, payload);
  },
  error(message: string, payload?: unknown) {
    jsonLog('app', 'error', message, payload);
    trackAlert('error_rate_spike', 10, 60_000);
  },
  security(message: string, payload?: unknown) {
    jsonLog('security_audit', 'info', message, payload);
  },
  trackSocketDisconnect(payload?: unknown) {
    jsonLog('app', 'warn', 'socket.disconnect', payload);
    trackAlert('socket_disconnect_storm', 25, 60_000);
  },
  trackAiValidationFailure(payload?: unknown) {
    jsonLog('app', 'warn', 'ai.validation.failure', payload);
    trackAlert('ai_validation_failures', 5, 60_000);
  },
};
