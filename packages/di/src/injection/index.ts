/**
 * @module
 * @description
 * The `di` module provides dependency injection container services.
 */

export * from './inject-options';
export * from './inject';
export * from './injection-token';
export * from './injection-context';
export * from './injector-get-options';
export * from './provider';

export { Injector } from './injector';
export { Provider, TypeProvider, ValueProvider, ClassProvider, ExistingProvider, FactoryProvider } from './provider';
export { ResolvedFactory } from './resolved-factory';
export { ResolvedProvider } from './resolved-provider';

export { Key } from './key';
export { InjectionToken } from './injection-token';
export { Type, isType } from './type';
