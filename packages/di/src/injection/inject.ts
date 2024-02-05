import { Type } from "./facade/type";
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
 * @returns 
 */
export function inject<T = unknown>(token: Type<T> | InjectionToken<T>, options?: InjectOptions): T {
    let injector = injectionContext().injector;
  
    if (options?.skipSelf ?? false)
      injector = injector.parent ?? injector;
  
    return injector.get(
      token, 
      options?.optional === true ? undefined : <any>THROW_IF_NOT_FOUND,
      { self: options?.self ?? false }
    );
  }
  