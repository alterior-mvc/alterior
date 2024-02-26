import { Type } from "./type";
import { InjectOptions } from "./inject-options";
import { injectionContext } from "./injection-context";
import { InjectionToken } from "./injection-token";
import { THROW_IF_NOT_FOUND } from "./throw-if-not-found";

const UNDEFINED = {}

/**
 * Get an injectable value by token from the current injector. This can only be used during creation of an injectable
 * (ie during class construction). It will throw otherwise.
 * 
 * @param token 
 * @param options 
 * @returns The resolved value of the given injection token. If the `optional` option is true and there is no provider
 *          for the given token, `null` is returned.
 */
export function inject<T = unknown>(token: Type<T> | InjectionToken<T>): T;
export function inject<T = unknown>(token: Type<T> | InjectionToken<T>, options: InjectOptions & { optional: true }): T | undefined;
export function inject<T = unknown>(token: Type<T> | InjectionToken<T>, options: InjectOptions & { optional?: false | undefined }): T;
export function inject<T = unknown>(token: Type<T> | InjectionToken<T>, options?: InjectOptions): T | undefined {
    let injector = injectionContext({ optional: options?.allowMissingContext ?? false })?.injector;
    if (!injector)
        return undefined;

    if (options?.skipSelf ?? false)
        injector = injector.parent ?? injector;

    
    let value = injector.get(
        token,
        options?.optional === true ? UNDEFINED : <any>THROW_IF_NOT_FOUND,
        { self: options?.self ?? false }
    );

    if (value === UNDEFINED)
        return undefined;

    return value;
}

/**
 * Get an injectable value by token from the current injector. This can only be used during creation of an injectable
 * (ie during class construction). It will throw otherwise.
 * 
 * @param token 
 * @param options 
 * @returns The resolved value of the given injection token. If the `optional` option is true and there is no provider
 *          for the given token, `null` is returned.
 */
export function injectMultiple<T = unknown>(token: Type<T> | InjectionToken<T>): T[];
export function injectMultiple<T = unknown>(token: Type<T> | InjectionToken<T>, options: InjectOptions & { optional: true }): T | undefined;
export function injectMultiple<T = unknown>(token: Type<T> | InjectionToken<T>, options: InjectOptions & { optional?: false | undefined }): T[];
export function injectMultiple<T = unknown>(token: Type<T> | InjectionToken<T>, options?: InjectOptions): T | undefined {
    let injector = injectionContext({ optional: options?.allowMissingContext ?? false })?.injector;
    if (!injector)
        return undefined;

    if (options?.skipSelf ?? false)
        injector = injector.parent ?? injector;

    
    let value = injector.get(
        token,
        options?.optional === true ? UNDEFINED : <any>THROW_IF_NOT_FOUND,
        { self: options?.self ?? false }
    );

    if (value === UNDEFINED)
        return undefined;

    return value;
}
