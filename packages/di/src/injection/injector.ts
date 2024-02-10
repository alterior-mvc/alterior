import { Dependency } from './dependency';
import { CyclicDependencyError, InjectionError, InstantiationError, NoProviderError, OutOfBoundsError } from './errors';
import { runInInjectionContext } from './injection-context';
import { InjectorGetOptions } from './injector-get-options';
import { Key } from './key';
import { Provider } from './provider';
import { ResolvedFactory } from './resolved-factory';
import { ResolvedProvider } from './resolved-provider';
import { THROW_IF_NOT_FOUND } from './throw-if-not-found';

// Threshold for the dynamic version
const UNDEFINED = new Object();

/**
 * A dependency injection container used for instantiating objects and resolving
 * dependencies.
 *
 * An `Injector` is a replacement for a `new` operator, which can automatically resolve the
 * constructor dependencies.
 *
 * In typical use, application code asks for the dependencies in the constructor and they are
 * resolved by the `Injector`.
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
 * var injector = Injector.resolveAndCreate([Car, Engine]);
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
export class Injector {
    private constructor(providers: ResolvedProvider[], parent: Injector | null = null) {
        this._providers = providers;
        this._parent = parent;
        this.keyIds = providers.map(p => p.key.id);
        this.instances = new Array(providers.length).fill(UNDEFINED);
    }

    private _constructionCounter: number = 0;
    private _providers: ResolvedProvider[];
    private _parent: Injector | null;
    private keyIds: number[];
    private instances: any[];
    private get maxNumberOfObjects() { return this.instances.length; }

    get(token: any, notFoundValue: any = THROW_IF_NOT_FOUND, options?: InjectorGetOptions): any {
        return this.getByKey(Key.get(token), options?.self ? 'self' : 'default', notFoundValue);
    }

    /**
     * Parent of this injector.
     *
     * For example:
     * 
     * ```typescript
     * var parent = Injector.resolveAndCreate([]);
     * var child = parent.resolveAndCreateChild([]);
     * expect(child.parent).toBe(parent);
     * ```
     */
    get parent(): Injector | null {
        return this._parent;
    }

    /**
     * Resolves an array of providers and creates a child injector from those providers.
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
     * var parent = Injector.resolveAndCreate([ParentProvider]);
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
    resolveAndCreateChild(providers: Provider[]): Injector {
        return this.createChildFromResolved(Injector.resolve(providers));
    }

    /**
     * Creates a child injector from previously resolved providers.
     *
     * This API is the recommended way to construct injectors in performance-sensitive parts.
     *
     * ### Example ([live demo](http://plnkr.co/edit/VhyfjN?p=preview))
     *
     * ```typescript
     * class ParentProvider {}
     * class ChildProvider {}
     *
     * var parentProviders = Injector.resolve([ParentProvider]);
     * var childProviders = Injector.resolve([ChildProvider]);
     *
     * var parent = Injector.fromResolvedProviders(parentProviders);
     * var child = parent.createChildFromResolved(childProviders);
     *
     * expect(child.get(ParentProvider) instanceof ParentProvider).toBe(true);
     * expect(child.get(ChildProvider) instanceof ChildProvider).toBe(true);
     * expect(child.get(ParentProvider)).toBe(parent.get(ParentProvider));
     * ```
     */
    createChildFromResolved(providers: ResolvedProvider[]): Injector {
        const inj = new Injector(providers);
        inj._parent = this;
        return inj;
    }

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
     * var injector = Injector.resolveAndCreate([Engine]);
     *
     * var car = injector.resolveAndInstantiate(Car);
     * expect(car.engine).toBe(injector.get(Engine));
     * expect(car).not.toBe(injector.resolveAndInstantiate(Car));
     * ```
     */
    resolveAndInstantiate(provider: Provider): any {
        return this.instantiate(Injector.resolve([provider])[0]);
    }

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
     * var injector = Injector.resolveAndCreate([Engine]);
     * var carProvider = Injector.resolve([Car])[0];
     * var car = injector.instantiateResolved(carProvider);
     * expect(car.engine).toBe(injector.get(Engine));
     * expect(car).not.toBe(injector.instantiateResolved(carProvider));
     * ```
     */
    instantiate(provider: ResolvedProvider): any {
        if (provider.multi) {
            const res = new Array(provider.resolvedFactories.length);
            for (let i = 0; i < provider.resolvedFactories.length; ++i) {
                res[i] = this.instantiateFromFactory(provider, provider.resolvedFactories[i]);
            }
            return res;
        }

        return this.instantiateFromFactory(provider, provider.resolvedFactories[0]);
    }

    /**
     * Instantiate the given provider while tracking the number of construct() operations which 
     * have occurred. The injector is designed to create the same number of objects as providers (one per provider),
     * if too many constructions occur and this number is surpassed, it is likely because of a cyclical dependency,
     * thus CyclicDependencyError is thrown.
     * 
     * @param provider 
     * @returns 
     */
    private construct(provider: ResolvedProvider): any {
        if (this._constructionCounter++ > this.maxNumberOfObjects) {
            throw new CyclicDependencyError(this, provider.key);
        }
        return this.instantiate(provider);
    }
    
    private getProviderAtIndex(index: number): ResolvedProvider {
        if (index < 0 || index >= this._providers.length)
            throw new OutOfBoundsError(index);
        return this._providers[index];
    }

    private instantiateFromFactory(
        provider: ResolvedProvider, 
        factory: () => any
    ): any {
        try {
            return runInInjectionContext(this, provider.key.token, factory);
        } catch (e: any) {
            if (e instanceof InjectionError) {
                e.addKey(this, provider.key);
                throw e;
            } else {
                throw new InstantiationError(this, provider.key, { cause: e });
            }
        }
    }

    private getByKey(key: Key, visibility: 'default' | 'self' | 'skip-self', notFoundValue: any): any {
        // tslint:disable-next-line:no-use-before-declare
        if (key === Key.get(Injector)) {
            return this;
        }

        if (visibility === 'self') {
            return this.getByKeySelf(key, notFoundValue);
        } else {
            return this.getByKeyDefault(key, notFoundValue, visibility);
        }
    }

    private getByKeyId(keyId: number): any {
        for (let i = 0; i < this.keyIds.length; i++) {
            if (this.keyIds[i] === keyId) {
                if (this.instances[i] === UNDEFINED) {
                    const provider = this._providers[i];
                    if (!provider.unique)
                        return this.instantiate(provider);
                    this.instances[i] = this.construct(provider);
                }

                return this.instances[i];
            }
        }

        return UNDEFINED;
    }

    /** @internal */
    private throwOrNull(key: Key, notFoundValue: any): any {
        if (notFoundValue !== THROW_IF_NOT_FOUND) {
            return notFoundValue;
        } else {
            throw new NoProviderError(this, key);
        }
    }

    /** @internal */
    private getByKeySelf(key: Key, notFoundValue: any): any {
        const obj = this.getByKeyId(key.id);
        return obj !== UNDEFINED ? obj : this.throwOrNull(key, notFoundValue);
    }

    /** @internal */
    private getByKeyDefault(key: Key, notFoundValue: any, visibility: 'self' | 'skip-self' | 'default'): any {
        let injector = visibility === 'skip-self' ? this._parent : this;

        while (injector) {
            const obj = injector.getByKeyId(key.id);
            if (obj !== UNDEFINED) return obj;
            injector = injector._parent;
        }
        
        return this.throwOrNull(key, notFoundValue);
    }

    get displayName(): string {
        const providers = this._mapProviders((b: ResolvedProvider) => ' "' + b.key.displayName + '" ').join(', ');
        return `Injector(providers: [${providers}])`;
    }

    private _mapProviders(fn: Function): any[] {
        const res: any[] = new Array(this._providers.length);
        for (let i = 0; i < this._providers.length; ++i) {
            res[i] = fn(this.getProviderAtIndex(i));
        }
        return res;
    }

    toString(): string {
        return this.displayName;
    }

    static readonly empty = this.resolveAndCreate([]);

    /**
     * Turns an array of provider definitions into an array of resolved providers.
     *
     * A resolution is a process of flattening multiple nested arrays and converting individual
     * providers into an array of {@link ResolvedProvider}s.
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
     * var providers = Injector.resolve([Car, [[Engine]]]);
     *
     * expect(providers.length).toEqual(2);
     *
     * expect(providers[0] instanceof ResolvedProvider).toBe(true);
     * expect(providers[0].key.displayName).toBe("Car");
     * expect(providers[0].dependencies.length).toEqual(1);
     * expect(providers[0].factory).toBeDefined();
     *
     * expect(providers[1].key.displayName).toBe("Engine");
     * });
     * ```
     *
     * See {@link Injector#fromResolvedProviders} for more info.
     */
    static resolve(providers: Provider[]): ResolvedProvider[] {
        return ResolvedProvider.fromArray(providers);
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
     * var injector = Injector.resolveAndCreate([Car, Engine]);
     * expect(injector.get(Car) instanceof Car).toBe(true);
     * ```
     *
     * This function is slower than the corresponding `fromResolvedProviders`
     * because it needs to resolve the passed-in providers first.
     * See {@link Injector#resolve} and {@link Injector#fromResolvedProviders}.
     */
    static resolveAndCreate(providers: Provider[], parent: Injector | null = null): Injector {
        return Injector.fromResolvedProviders(
            Injector.resolve(providers),
            parent
        );
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
     * var providers = Injector.resolve([Car, Engine]);
     * var injector = Injector.fromResolvedProviders(providers);
     * expect(injector.get(Car) instanceof Car).toBe(true);
     * ```
     * @experimental
     */
    static fromResolvedProviders(providers: ResolvedProvider[], parent: Injector | null = null): Injector {
        // tslint:disable-next-line:no-use-before-declare
        return new Injector(providers, parent);
    }

}
