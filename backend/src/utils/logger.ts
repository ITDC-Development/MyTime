type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, data?: unknown) {
  const entry = { severity: level.toUpperCase(), message, ...(data ? { data } : {}) };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (msg: string, data?: unknown) => emit('info', msg, data),
  warn: (msg: string, data?: unknown) => emit('warn', msg, data),
  error: (msg: string, data?: unknown) => emit('error', msg, data),
};
