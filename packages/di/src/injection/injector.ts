/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { stringify } from './facade/lang';
import { Type } from './facade/type';

import { InjectionToken } from './injection_token';

const _THROW_IF_NOT_FOUND = new Object();
export const THROW_IF_NOT_FOUND = _THROW_IF_NOT_FOUND;

// tslint:disable-next-line:class-name no-use-before-declare
class _NullInjector implements Injector {
  get(token: any, notFoundValue: any = _THROW_IF_NOT_FOUND): any {
    if (notFoundValue === _THROW_IF_NOT_FOUND) {
      throw new Error(`No provider for ${stringify(token)}!`);
    }
    return notFoundValue;
  }

  parent = null;
}

export interface InjectionContext {
  injector: Injector;
  token: object;
};

let CURRENT_INJECTION_CONTEXT: InjectionContext | null = null;

export interface InjectorGetOptions {
  /**
   * Do not fall back to parent injector (if one exists for this injector).
   */
  self?: boolean;
}

/**
 * @whatItDoes Injector interface
 * @howToUse
 * ```
 * const injector: Injector = ...;
 * injector.get(...);
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/injector_spec.ts region='Injector'}
 *
 * `Injector` returns itself when given `Injector` as a token:
 * {@example core/di/ts/injector_spec.ts region='injectInjector'}
 *
 * @stable
 */
export abstract class Injector {
  static THROW_IF_NOT_FOUND = _THROW_IF_NOT_FOUND;
  static NULL: Injector = new _NullInjector();

  /**
   * Retrieve the parent injector, if one exists.
   * Not all injectors support this.
   */
  readonly parent: Injector | null = null;

  /**
   * Retrieves an instance from the injector based on the provided token.
   * If not found:
   * - Throws {@link NoProviderError} if no `notFoundValue` that is not equal to
   * Injector.THROW_IF_NOT_FOUND is given
   * - Returns the `notFoundValue` otherwise
   */
  abstract get<T>(token: Type<T> | InjectionToken<T>, notFoundValue?: T, options?: InjectorGetOptions): T;
  /**
   * @deprecated from v4.0.0 use Type<T> or InjectionToken<T>
   * @suppress {duplicate}
   */
  abstract get(token: any, notFoundValue?: any): any;

  /**
   * @internal
   */
  static _runInInjectionContext(injector: Injector, token: Object, callback: () => void) {
    let previousContext = CURRENT_INJECTION_CONTEXT;
    CURRENT_INJECTION_CONTEXT = { injector, token };
    try {
      callback();
    } finally {
      CURRENT_INJECTION_CONTEXT = previousContext;
    }
  }
}

/**
 * Type of the options argument to `inject`.
 *
 * @publicApi
 */
export declare interface InjectOptions {
  /**
   * Use optional injection, and return `null` if the requested token is not found.
   */
  optional?: boolean;
  /**
   * Start injection at the parent of the current injector.
   */
  skipSelf?: boolean;
  /**
   * Only query the current injector for the token, and don't fall back to the parent injector if
   * it's not found.
   */
  self?: boolean;
}

export function injectionContext(): InjectionContext {
  if (CURRENT_INJECTION_CONTEXT === null)
    throw new Error(`Can only be called during creation of a dependency injection provider.`);

  return { ...CURRENT_INJECTION_CONTEXT };
}

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
