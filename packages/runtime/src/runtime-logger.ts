import { InjectionToken } from "@alterior/di";

export type RuntimeLogSeverity = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal';
export const RUNTIME_LOGGER = new InjectionToken<RuntimeLogger>("RUNTIME_LOGGER");

export interface RuntimeLogger {
    trace(message: string): void;
    info(message: string): void;
    fatal(message: string): void;
    debug(message: string): void;
    warning(message: string): void;
    error(message: string): void;
}

export class DefaultRuntimeLogger implements RuntimeLogger {
    trace(message: string) { console.trace(message); }
    info(message: string) { console.info(message); }
    fatal(message: string) { console.error(message); }
    debug(message: string) { console.debug(message); }
    warning(message: string) { console.warn(message); }
    error(message: string) { console.error(message); }
}

export class SilentRuntimeLogger implements RuntimeLogger {
    trace(message: string) {}
    info(message: string) {}
    fatal(message: string) {}
    debug(message: string) {}
    warning(message: string) {}
    error(message: string) {}
}