import { CURRENT_INJECTION_CONTEXT_STORAGE } from "./current-injection-context-private";
import { Injector } from "./injector";

export interface InjectionContext {
    injector: Injector;
    token: object;
};

export function injectionContext(): InjectionContext {
    if (CURRENT_INJECTION_CONTEXT_STORAGE.context === null)
        throw new Error(`Can only be called during creation of a dependency injection provider.`);

    return { ...CURRENT_INJECTION_CONTEXT_STORAGE.context };
}

/**
 * @internal
 */
export function runInInjectionContext<T>(injector: Injector, token: Object, callback: () => T): T {
    let previousContext = CURRENT_INJECTION_CONTEXT_STORAGE.context;
    CURRENT_INJECTION_CONTEXT_STORAGE.context = { injector, token };
    try {
        return callback();
    } finally {
        CURRENT_INJECTION_CONTEXT_STORAGE.context = previousContext;
    }
}