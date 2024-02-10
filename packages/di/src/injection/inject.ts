import { Type } from "./type";
import { InjectOptions } from "./inject-options";
import { injectionContext } from "./injection-context";
import { InjectionToken } from "./injection-token";
import { THROW_IF_NOT_FOUND } from "./throw-if-not-found";

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
export function inject<T = unknown>(token: Type<T> | InjectionToken<T>, options: InjectOptions & { optional: true }): T | null;
export function inject<T = unknown>(token: Type<T> | InjectionToken<T>, options: InjectOptions & { optional?: false | undefined }): T;
export function inject<T = unknown>(token: Type<T> | InjectionToken<T>, options?: InjectOptions): T | null {
    let injector = injectionContext().injector;
  
    if (options?.skipSelf ?? false)
      injector = injector.parent ?? injector;
  
    return injector.get(
      token, 
      options?.optional === true ? null : <any>THROW_IF_NOT_FOUND,
      { self: options?.self ?? false }
    );
  }
  