/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Annotation } from '@alterior/annotations';
import { CyclicDependencyError, InstantiationError, NoProviderError, OutOfBoundsError } from './errors';
import { ConcreteType } from './facade/type';
import { runInInjectionContext } from './injection-context';
import { Injector } from './injector';
import { InjectorGetOptions } from './injector-get-options';
import { InjectAnnotation, Optional, OptionalAnnotation, SelfAnnotation, Skip, SkipAnnotation, SkipSelfAnnotation } from './metadata';
import { ClassProvider, Provider, ProviderWithDependencies, isTypeProvider } from './provider';
import { ReflectiveKey } from './reflective-key';
import {
  ReflectiveDependency,
  ResolvedReflectiveFactory,
  ResolvedReflectiveProvider,
  resolveReflectiveProviders,
} from './reflective-provider';
import { THROW_IF_NOT_FOUND } from './throw-if-not-found';

// Threshold for the dynamic version
const UNDEFINED = new Object();

/**
 * A ReflectiveDependency injection container used for instantiating objects and resolving
 * dependencies.
 *
 * An `Injector` is a replacement for a `new` operator, which can automatically resolve the
 * constructor dependencies.
 *
 * In typical use, application code asks for the dependencies in the constructor and they are
 * resolved by the `Injector`.
 *
 * ### Example ([live demo](http://plnkr.co/edit/jzjec0?p=preview))
 *
 * The following example creates an `Injector` configured to create `Engine` and `Car`.
 *
 * ```typescript
 * @Injectable()
 * class Engine {
 * }
 *
 * @Injectable()
 * class Car {
 *   constructor(public engine:Engine) {}
 * }
 *
 * var injector = ReflectiveInjector.resolveAndCreate([Car, Engine]);
 * var car = injector.get(Car);
 * expect(car instanceof Car).toBe(true);
 * expect(car.engine instanceof Engine).toBe(true);
 * ```
 *
 * Notice, we don't use the `new` operator because we explicitly want to have the `Injector`
 * resolve all of the object's dependencies automatically.
 *
 * @stable
 */
export abstract class ReflectiveInjector implements Injector {
  /**
   * Turns an array of provider definitions into an array of resolved providers.
   *
   * A resolution is a process of flattening multiple nested arrays and converting individual
   * providers into an array of {@link ResolvedReflectiveProvider}s.
   *
   * ### Example ([live demo](http://plnkr.co/edit/AiXTHi?p=preview))
   *
   * ```typescript
   * @Injectable()
   * class Engine {
   * }
   *
   * @Injectable()
   * class Car {
   *   constructor(public engine:Engine) {}
   * }
   *
   * var providers = ReflectiveInjector.resolve([Car, [[Engine]]]);
   *
   * expect(providers.length).toEqual(2);
   *
   * expect(providers[0] instanceof ResolvedReflectiveProvider).toBe(true);
   * expect(providers[0].key.displayName).toBe("Car");
   * expect(providers[0].dependencies.length).toEqual(1);
   * expect(providers[0].factory).toBeDefined();
   *
   * expect(providers[1].key.displayName).toBe("Engine");
   * });
   * ```
   *
   * See {@link ReflectiveInjector#fromResolvedProviders} for more info.
   */
  static resolve(providers: Provider[]): ResolvedReflectiveProvider[] {
    return resolveReflectiveProviders(providers);
  }

  /**
   * Resolves an array of providers and creates an injector from those providers.
   *
   * The passed-in providers can be an array of `Type`, {@link Provider},
   * or a recursive array of more providers.
   *
   * ### Example ([live demo](http://plnkr.co/edit/ePOccA?p=preview))
   *
   * ```typescript
   * @Injectable()
   * class Engine {
   * }
   *
   * @Injectable()
   * class Car {
   *   constructor(public engine:Engine) {}
   * }
   *
   * var injector = ReflectiveInjector.resolveAndCreate([Car, Engine]);
   * expect(injector.get(Car) instanceof Car).toBe(true);
   * ```
   *
   * This function is slower than the corresponding `fromResolvedProviders`
   * because it needs to resolve the passed-in providers first.
   * See {@link Injector#resolve} and {@link Injector#fromResolvedProviders}.
   */
  static resolveAndCreate(providers: Provider[], parent: Injector | null = null): ReflectiveInjector {
    const ResolvedReflectiveProviders = ReflectiveInjector.resolve(providers);
    return ReflectiveInjector.fromResolvedProviders(ResolvedReflectiveProviders, parent);
  }

  /**
   * Extract the dependencies of the given providers
   * @param providers 
   */
  static reflectDependencies(provider : Provider): ProviderWithDependencies {
    if (isTypeProvider(provider)) {
      provider = {
        provide: provider,
        useClass: <ConcreteType<any>>provider
      };
    }

    if (!('useClass' in provider))
      return provider;
  
    let classProvider : ClassProvider = <any>provider;

    const paramsAnnotations = Annotation.getAllForConstructorParameters(classProvider.useClass);
    let params = Reflect.getOwnMetadata('design:paramtypes', classProvider.useClass);
    let deps = [];

    if (classProvider.useClass.length > 0 && typeof params === 'undefined') {
      throw new Error(
        `missing-reflection: No reflection metadata available ` 
        + `for ${classProvider.useClass.name}`
      );
    }

    if (params && params.length > 0) {
      for (let i = 0; i < params.length; ++i) {
        let param = params[i];
        let paramAnnotations = paramsAnnotations[i] || [];

        let injectAnnotation = <InjectAnnotation>paramAnnotations.find(x => x instanceof InjectAnnotation);
        let skipAnnotation = <SkipAnnotation>paramAnnotations.find(x => x instanceof SkipAnnotation);
        let optionalAnnotation = <OptionalAnnotation>paramAnnotations.find(x => x instanceof OptionalAnnotation);

        let token = param;

        if (injectAnnotation) {
          token = injectAnnotation.token;
        }

        let dep : any = token;

        if (skipAnnotation) {
          dep = [ Skip, token ]
        } else if (optionalAnnotation) {
          dep = [ Optional, token ];
        } else {
          dep = token;
        }

        deps.push(dep);
      }
    }

    return <ProviderWithDependencies>{
      provide: classProvider.provide,
      useClass: classProvider.useClass,
      deps
    }
  }

  /**
   * Creates an injector from previously resolved providers.
   *
   * This API is the recommended way to construct injectors in performance-sensitive parts.
   *
   * ### Example ([live demo](http://plnkr.co/edit/KrSMci?p=preview))
   *
   * ```typescript
   * @Injectable()
   * class Engine {
   * }
   *
   * @Injectable()
   * class Car {
   *   constructor(public engine:Engine) {}
   * }
   *
   * var providers = ReflectiveInjector.resolve([Car, Engine]);
   * var injector = ReflectiveInjector.fromResolvedProviders(providers);
   * expect(injector.get(Car) instanceof Car).toBe(true);
   * ```
   * @experimental
   */
  static fromResolvedProviders(providers: ResolvedReflectiveProvider[], parent: Injector | null = null): ReflectiveInjector {
    // tslint:disable-next-line:no-use-before-declare
    return new ReflectiveInjector_(providers, parent);
  }

  /**
   * Parent of this injector.
   *
   * <!-- TODO: Add a link to the section of the user guide talking about hierarchical injection.
   * -->
   *
   * ### Example ([live demo](http://plnkr.co/edit/eosMGo?p=preview))
   *
   * ```typescript
   * var parent = ReflectiveInjector.resolveAndCreate([]);
   * var child = parent.resolveAndCreateChild([]);
   * expect(child.parent).toBe(parent);
   * ```
   */
  abstract get parent(): Injector | null;

  /**
   * Resolves an array of providers and creates a child injector from those providers.
   *
   * <!-- TODO: Add a link to the section of the user guide talking about hierarchical injection.
   * -->
   *
   * The passed-in providers can be an array of `Type`, {@link Provider},
   * or a recursive array of more providers.
   *
   * ### Example ([live demo](http://plnkr.co/edit/opB3T4?p=preview))
   *
   * ```typescript
   * class ParentProvider {}
   * class ChildProvider {}
   *
   * var parent = ReflectiveInjector.resolveAndCreate([ParentProvider]);
   * var child = parent.resolveAndCreateChild([ChildProvider]);
   *
   * expect(child.get(ParentProvider) instanceof ParentProvider).toBe(true);
   * expect(child.get(ChildProvider) instanceof ChildProvider).toBe(true);
   * expect(child.get(ParentProvider)).toBe(parent.get(ParentProvider));
   * ```
   *
   * This function is slower than the corresponding `createChildFromResolved`
   * because it needs to resolve the passed-in providers first.
   * See {@link Injector#resolve} and {@link Injector#createChildFromResolved}.
   */
  abstract resolveAndCreateChild(providers: Provider[]): ReflectiveInjector;

  /**
   * Creates a child injector from previously resolved providers.
   *
   * <!-- TODO: Add a link to the section of the user guide talking about hierarchical injection.
   * -->
   *
   * This API is the recommended way to construct injectors in performance-sensitive parts.
   *
   * ### Example ([live demo](http://plnkr.co/edit/VhyfjN?p=preview))
   *
   * ```typescript
   * class ParentProvider {}
   * class ChildProvider {}
   *
   * var parentProviders = ReflectiveInjector.resolve([ParentProvider]);
   * var childProviders = ReflectiveInjector.resolve([ChildProvider]);
   *
   * var parent = ReflectiveInjector.fromResolvedProviders(parentProviders);
   * var child = parent.createChildFromResolved(childProviders);
   *
   * expect(child.get(ParentProvider) instanceof ParentProvider).toBe(true);
   * expect(child.get(ChildProvider) instanceof ChildProvider).toBe(true);
   * expect(child.get(ParentProvider)).toBe(parent.get(ParentProvider));
   * ```
   */
  abstract createChildFromResolved(providers: ResolvedReflectiveProvider[]): ReflectiveInjector;

  /**
   * Resolves a provider and instantiates an object in the context of the injector.
   *
   * The created object does not get cached by the injector.
   *
   * ### Example ([live demo](http://plnkr.co/edit/yvVXoB?p=preview))
   *
   * ```typescript
   * @Injectable()
   * class Engine {
   * }
   *
   * @Injectable()
   * class Car {
   *   constructor(public engine:Engine) {}
   * }
   *
   * var injector = ReflectiveInjector.resolveAndCreate([Engine]);
   *
   * var car = injector.resolveAndInstantiate(Car);
   * expect(car.engine).toBe(injector.get(Engine));
   * expect(car).not.toBe(injector.resolveAndInstantiate(Car));
   * ```
   */
  abstract resolveAndInstantiate(provider: Provider): any;

  /**
   * Instantiates an object using a resolved provider in the context of the injector.
   *
   * The created object does not get cached by the injector.
   *
   * ### Example ([live demo](http://plnkr.co/edit/ptCImQ?p=preview))
   *
   * ```typescript
   * @Injectable()
   * class Engine {
   * }
   *
   * @Injectable()
   * class Car {
   *   constructor(public engine:Engine) {}
   * }
   *
   * var injector = ReflectiveInjector.resolveAndCreate([Engine]);
   * var carProvider = ReflectiveInjector.resolve([Car])[0];
   * var car = injector.instantiateResolved(carProvider);
   * expect(car.engine).toBe(injector.get(Engine));
   * expect(car).not.toBe(injector.instantiateResolved(carProvider));
   * ```
   */
  abstract instantiateResolved(provider: ResolvedReflectiveProvider): any;

  abstract get(token: any, notFoundValue?: any): any;
}

// tslint:disable-next-line:class-name
export class ReflectiveInjector_ implements ReflectiveInjector {
  /** @internal */
  _constructionCounter: number = 0;
  /** @internal */
  public _providers: ResolvedReflectiveProvider[];
  /** @internal */
  public _parent: Injector | null;

  keyIds: number[];
  objs: any[];
  /**
   * Private
   */
  constructor(_providers: ResolvedReflectiveProvider[], _parent: Injector | null = null) {
    this._providers = _providers;
    this._parent = _parent;

    const len = _providers.length;

    this.keyIds = new Array(len);
    this.objs = new Array(len);

    for (let i = 0; i < len; i++) {
      this.keyIds[i] = _providers[i].key.id;
      this.objs[i] = UNDEFINED;
    }
  }

  private _useSelf = new SelfAnnotation();

  get(token: any, notFoundValue: any = THROW_IF_NOT_FOUND, options?: InjectorGetOptions): any {
    return this._getByKey(ReflectiveKey.get(token), options?.self ? this._useSelf: null, notFoundValue);
  }

  get parent(): Injector | null {
    return this._parent;
  }

  resolveAndCreateChild(providers: Provider[]): ReflectiveInjector {
    const ResolvedReflectiveProviders = ReflectiveInjector.resolve(providers);
    return this.createChildFromResolved(ResolvedReflectiveProviders);
  }

  createChildFromResolved(providers: ResolvedReflectiveProvider[]): ReflectiveInjector {
    const inj = new ReflectiveInjector_(providers);
    inj._parent = this;
    return inj;
  }

  resolveAndInstantiate(provider: Provider): any {
    return this.instantiateResolved(ReflectiveInjector.resolve([provider])[0]);
  }

  instantiateResolved(provider: ResolvedReflectiveProvider): any {
    return this._instantiateProvider(provider);
  }

  getProviderAtIndex(index: number): ResolvedReflectiveProvider {
    if (index < 0 || index >= this._providers.length) {
      throw new OutOfBoundsError(index);
    }
    return this._providers[index];
  }

  /** @internal */
  _new(provider: ResolvedReflectiveProvider): any {
    if (this._constructionCounter++ > this._getMaxNumberOfObjects()) {
      throw new CyclicDependencyError(this, provider.key);
    }
    return this._instantiateProvider(provider);
  }

  private _getMaxNumberOfObjects(): number {
    return this.objs.length;
  }

  private _instantiateProvider(provider: ResolvedReflectiveProvider): any {
    if (provider.multiProvider) {
      const res = new Array(provider.resolvedFactories.length);
      for (let i = 0; i < provider.resolvedFactories.length; ++i) {
        res[i] = this._instantiate(provider, provider.resolvedFactories[i]);
      }
      return res;
    } else {
      return this._instantiate(provider, provider.resolvedFactories[0]);
    }
  }

  private _instantiate(provider: ResolvedReflectiveProvider, ResolvedReflectiveFactory: ResolvedReflectiveFactory): any {
    const factory = ResolvedReflectiveFactory.factory;

    let deps: any[];
    try {
      deps = ResolvedReflectiveFactory.dependencies.map(dep => this._getByReflectiveDependency(dep));
    } catch (e: any) {
      if (e.addKey) {
        e.addKey(this, provider.key);
      }
      throw e;
    }

    let obj: any;
    try {
      runInInjectionContext(this, provider.key.token, () => {
        obj = factory(...deps);
      });
    } catch (e: any) {
      throw new InstantiationError(this, provider.key, { cause: e });
    }

    return obj;
  }

  private _getByReflectiveDependency(dep: ReflectiveDependency): any {
    if (dep.skip)
      return undefined;
    return this._getByKey(dep.key, dep.visibility, dep.optional ? null : THROW_IF_NOT_FOUND);
  }

  private _getByKey(key: ReflectiveKey, visibility: SelfAnnotation | SkipSelfAnnotation | null, notFoundValue: any): any {
    // tslint:disable-next-line:no-use-before-declare
    if (key === INJECTOR_KEY) {
      return this;
    }

    if (visibility instanceof SelfAnnotation) {
      return this._getByKeySelf(key, notFoundValue);
    } else {
      return this._getByKeyDefault(key, notFoundValue, visibility);
    }
  }

  private _getObjByKeyId(keyId: number): any {
    for (let i = 0; i < this.keyIds.length; i++) {
      if (this.keyIds[i] === keyId) {
        if (this.objs[i] === UNDEFINED) {
          this.objs[i] = this._new(this._providers[i]);
        }

        return this.objs[i];
      }
    }

    return UNDEFINED;
  }

  /** @internal */
  _throwOrNull(key: ReflectiveKey, notFoundValue: any): any {
    if (notFoundValue !== THROW_IF_NOT_FOUND) {
      return notFoundValue;
    } else {
      throw new NoProviderError(this, key);
    }
  }

  /** @internal */
  _getByKeySelf(key: ReflectiveKey, notFoundValue: any): any {
    const obj = this._getObjByKeyId(key.id);
    return obj !== UNDEFINED ? obj : this._throwOrNull(key, notFoundValue);
  }

  /** @internal */
  _getByKeyDefault(key: ReflectiveKey, notFoundValue: any, visibility: SelfAnnotation | SkipSelfAnnotation | null): any {
    let inj: Injector | null;

    if (visibility instanceof SkipSelfAnnotation) {
      inj = this._parent;
    } else {
      inj = this;
    }

    while (inj instanceof ReflectiveInjector_) {
      const inj_ = <ReflectiveInjector_>inj;
      const obj = inj_._getObjByKeyId(key.id);
      if (obj !== UNDEFINED) return obj;
      inj = inj_._parent;
    }
    if (inj !== null) {
      return inj.get(key.token, notFoundValue);
    } else {
      return this._throwOrNull(key, notFoundValue);
    }
  }

  get displayName(): string {
    const providers = _mapProviders(this, (b: ResolvedReflectiveProvider) => ' "' + b.key.displayName + '" ').join(', ');
    return `ReflectiveInjector(providers: [${providers}])`;
  }

  toString(): string {
    return this.displayName;
  }
}

const INJECTOR_KEY = ReflectiveKey.get(Injector);

function _mapProviders(injector: ReflectiveInjector_, fn: Function): any[] {
  const res: any[] = new Array(injector._providers.length);
  for (let i = 0; i < injector._providers.length; ++i) {
    res[i] = fn(injector.getProviderAtIndex(i));
  }
  return res;
}
