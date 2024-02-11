import { CURRENT_INJECTION_CONTEXT_STORAGE } from "./current-injection-context-private";
import { Injector } from "./injector";

export interface InjectionContext {
    injector: Injector;
    token: any;
};

export interface InjectionContextOptions {
    /**
     * When true, `undefined` will be returned if there is not a current injection context.
     * Otherwise, an error is thrown.
     */
    optional?: boolean;
}

/**
 * Retrieve the current injection context. 
 * @throws When there is no active injection context, unless `options.optional` is true.
 */
export function injectionContext(): InjectionContext;
export function injectionContext(options?: InjectionContextOptions & { optional: true }): InjectionContext | undefined;
export function injectionContext(options?: InjectionContextOptions): InjectionContext | undefined;
export function injectionContext(options?: InjectionContextOptions): InjectionContext | undefined {
    if (CURRENT_INJECTION_CONTEXT_STORAGE.context === null) {
        if (options?.optional === true)
            return undefined;

        throw new Error(`Can only be called during instantiation of a dependency injection provider.`);
    }

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