import { InjectionToken } from './injection-token';
import { ConcreteType, Type } from './type';

/**
 * Configures the {@link Injector} to return an instance of `Type` when `Type' is used
 * as token.
 * 
 * ```
 * class MyService {}
 * const provider: TypeProvider = MyService;
 * ```
 *
 * Create an instance by invoking the `new` operator and supplying additional arguments.
 * This form is a short form of `TypeProvider`;
 */
export type TypeProvider<T> = ConcreteType<T> | (() => ConcreteType<T>);

export type ProviderToken<T> = Type<T> | InjectionToken<T> | (() => (Type<T> | InjectionToken<T>));

interface ProviderBase<T> {
  /**
   * An injection token. (Typically an instance of `Type` or `InjectionToken`, but can be `any`).
   */
  provide: ProviderToken<T>;

  /**
   * If true, then injector returns an array of instances. This is useful to allow multiple
   * providers spread across many files to provide configuration information to a common token.
   */
  multi?: boolean;
}

/**
 * Configures the {@link Injector} to return a value for a token.
 * 
 * ```
 * const provider: ValueProvider = {provide: 'someToken', useValue: 'someValue'};
 * ```
 */
export interface ValueProvider<T> extends ProviderBase<T> {
  /**
   * The value to inject.
   */
  useValue: T;
}

/**
 * Configures the {@link Injector} to return an instance of `useClass` for a token.
 * 
 * ```
 * class MyService {}
 * const provider: ClassProvider = {provide: 'someToken', useClass: MyService};
 * ```
 */
export interface ClassProvider<T> extends ProviderBase<T> {
  /**
   * Class to instantiate for the `token`.
   */
  useClass: ConcreteType<T> | (() => ConcreteType<T>);

  /**
   * When true (the default), the class will only be constructed once, and all injections will share it.
   * When false, the class will be constructed each time an injection occurs.
   */
  unique?: boolean;
}

/**
 * Configures the {@link Injector} to return a value of another `useExisting` token.
 * 
 * ```typescript
 * const provider: ExistingProvider = {provide: 'someToken', useExisting: 'someOtherToken'};
 * ```
 */
export interface ExistingProvider<T> extends ProviderBase<T> {
  /**
   * Existing `token` to return. (equivalent to `injector.get(useExisting)`)
   */
  useExisting: Type<T> | InjectionToken<T> | (() => Type<T> | InjectionToken<T>);
}

/**
 * Configures the {@link Injector} to return a value by invoking a `useFactory`
 * function.
 * 
 * ```
 * function serviceFactory() { ... }
 *
 * const provider: FactoryProvider = {provide: 'someToken', useFactory: serviceFactory, deps: []};
 * ```
 */
export interface FactoryProvider<T> extends ProviderBase<T> {
  /**
   * A function to invoke to create a value for this `token`. The function is invoked with
   * resolved values of `token`s in the `deps` field.
   */
  useFactory: () => T;

  /**
   * When true (the default), the factory will only be called once, and all injections will share the same value.
   * When false, the factory will be called each time an injection occurs.
   */
  unique?: boolean;
}

/**
 * Describes how the {@link Injector} should be configured.
 * 
 * See {@link TypeProvider}, {@link ValueProvider}, {@link ClassProvider}, {@link ExistingProvider},
 * {@link FactoryProvider}.
 */
export type Provider<T = any> = TypeProvider<T> | ValueProvider<T> | ClassProvider<T> | ExistingProvider<T> | FactoryProvider<T> | Provider<any>[];

export function isTypeProvider<T>(provider: Provider<T>): provider is TypeProvider<T> {
  return typeof provider === 'function';
}

export interface ProviderDependencies {
  deps? : any[];
}

export type ProviderWithDependencies = Provider & ProviderDependencies;

export function provide<T>(provide: ProviderToken<T>, options: { multi?: boolean, unique?: boolean } = {}) {
  return new ProviderBuilder(provide, options);
}

export class ProviderBuilder<T> {
  constructor(private readonly provide: ProviderToken<T>, private readonly options: { multi?: boolean, unique?: boolean } = {}) {
  }

  usingValue(value: T): ValueProvider<T> { return { provide: this.provide, useValue: value, multi: this.options.multi }; }
  using(token: ProviderToken<T>): ExistingProvider<T> { return { provide: this.provide, useExisting: token, multi: this.options.multi }; }
  usingFactory(factory: () => T): FactoryProvider<T> { return { provide: this.provide, useFactory: factory, multi: this.options.multi, unique: this.options.unique }; }
  usingClass(constructor: ConcreteType<T>): ClassProvider<T> { return { provide: this.provide, useClass: constructor, multi: this.options.multi, unique: this.options.unique }; }
}