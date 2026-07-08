type LogContext = Record<string, unknown>;

function noop(...args: unknown[]) {
  void args;
  return undefined;
}

export function init(options?: unknown) {
  void options;
  return undefined;
}

export function captureException(error: unknown) {
  void error;
  return undefined;
}

export function captureRequestError(...args: unknown[]) {
  void args;
  return undefined;
}

export function captureRouterTransitionStart(url: string, navigationType: string) {
  void url;
  void navigationType;
  return undefined;
}

export function replayIntegration(options?: unknown) {
  void options;
  return {};
}

export const logger = {
  info(_message: string, _context?: LogContext) {
    noop(_message, _context);
  },
  warn(_message: string, _context?: LogContext) {
    noop(_message, _context);
  },
  error(_message: string, _context?: LogContext) {
    noop(_message, _context);
  }
};
