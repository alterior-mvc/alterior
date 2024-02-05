/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * @module
 * @description
 * The `di` module provides dependency injection container services.
 */

export * from './metadata';

export { forwardRef, resolveForwardRef, ForwardRefFn } from './forward-ref';

export * from './forward-ref';
export * from './inject-options';
export * from './inject';
export * from './injection-token';
export * from './injection-context';
export * from './injector-get-options';
export * from './null-injector';
export * from './provider';

export { Injector } from './injector';
export { ReflectiveInjector } from './reflective-injector';
export { Provider, TypeProvider, ValueProvider, ClassProvider, ExistingProvider, FactoryProvider } from './provider';
export { ResolvedReflectiveFactory, ResolvedReflectiveProvider } from './reflective-provider';
export { ReflectiveKey } from './reflective-key';
export { InjectionToken, OpaqueToken } from './injection-token';
export { Type, isType } from './facade/type';
