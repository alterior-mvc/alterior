
export const LOG_SEVERITY_RANKS = {
    'trace': 0,
    'debug': 1,
    'info': 2,
    'warning': 3,
    'error': 4,
    'fatal': 5
}

export type LogSeverity = keyof typeof LOG_SEVERITY_RANKS;
