import { ConcreteType } from './type';

/**
 * Configures the {@link Injector} to return an instance of `Type` when `Type' is used
 * as token.
 * 
 * ```
 * @Injectable()
 * class MyService {}
 *
 * const provider: TypeProvider = MyService;
 * ```
 *
 * Create an instance by invoking the `new` operator and supplying additional arguments.
 * This form is a short form of `TypeProvider`;
 */
export type TypeProvider = ConcreteType<any> | (() => ConcreteType<any>);

interface ProviderBase {
  /**
   * An injection token. (Typically an instance of `Type` or `InjectionToken`, but can be `any`).
   */
  provide: any;

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
export interface ValueProvider extends ProviderBase {
  /**
   * The value to inject.
   */
  useValue: any;
}

/**
 * Configures the {@link Injector} to return an instance of `useClass` for a token.
 * 
 * ```
 * @Injectable()
 * class MyService {}
 *
 * const provider: ClassProvider = {provide: 'someToken', useClass: MyService};
 * ```
 */
export interface ClassProvider extends ProviderBase {
  /**
   * Class to instantiate for the `token`.
   */
  useClass: ConcreteType<any> | (() => ConcreteType<any>);

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
export interface ExistingProvider extends ProviderBase {
  /**
   * Existing `token` to return. (equivalent to `injector.get(useExisting)`)
   */
  useExisting: any;
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
export interface FactoryProvider extends ProviderBase {
  /**
   * A function to invoke to create a value for this `token`. The function is invoked with
   * resolved values of `token`s in the `deps` field.
   */
  useFactory: () => any;

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
export type Provider = TypeProvider | ValueProvider | ClassProvider | ExistingProvider | FactoryProvider | any[];

export function isTypeProvider(provider: Provider): provider is TypeProvider {
  return typeof provider === 'function';
}

export interface ProviderDependencies {
  deps? : any[];
}

export type ProviderWithDependencies = Provider & ProviderDependencies;