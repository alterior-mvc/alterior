import { Annotation } from '@alterior/annotations';
import { CyclicDependencyError, InjectionError, InstantiationError, NoProviderError, OutOfBoundsError } from './errors';
import { ConcreteType } from './type';
import { runInInjectionContext } from './injection-context';
import { InjectorGetOptions } from './injector-get-options';
import { InjectAnnotation, Optional, OptionalAnnotation, SelfAnnotation, Skip, SkipAnnotation, SkipSelfAnnotation } from './metadata';
import { ClassProvider, Provider, ProviderWithDependencies, isTypeProvider } from './provider';
import { Key } from './key';
import { THROW_IF_NOT_FOUND } from './throw-if-not-found';
import { ResolvedProvider } from './resolved-provider';
import { ResolvedFactory } from './resolved-factory';
import { Dependency } from './dependency';

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
    private _useSelf = new SelfAnnotation();
    private get maxNumberOfObjects() { return this.instances.length; }

    get(token: any, notFoundValue: any = THROW_IF_NOT_FOUND, options?: InjectorGetOptions): any {
        return this.getByKey(Key.get(token), options?.self ? this._useSelf : null, notFoundValue);
    }

    /**
     * Parent of this injector.
     *
     * For example:
     * 
     * ```typescript
     * var parent = ReflectiveInjector.resolveAndCreate([]);
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
    resolveAndCreateChild(providers: Provider[]): Injector {
        const ResolvedReflectiveProviders = Injector.resolve(providers);
        return this.createChildFromResolved(ResolvedReflectiveProviders);
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
     * var injector = ReflectiveInjector.resolveAndCreate([Engine]);
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
     * var injector = ReflectiveInjector.resolveAndCreate([Engine]);
     * var carProvider = ReflectiveInjector.resolve([Car])[0];
     * var car = injector.instantiateResolved(carProvider);
     * expect(car.engine).toBe(injector.get(Engine));
     * expect(car).not.toBe(injector.instantiateResolved(carProvider));
     * ```
     */
    instantiate(provider: ResolvedProvider): any {
        if (provider.multiProvider) {
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
        ResolvedReflectiveFactory: ResolvedFactory
    ): any {
        const factory = ResolvedReflectiveFactory.factory;

        let deps: any[];
        try {
            deps = ResolvedReflectiveFactory.dependencies.map(dep => this.getByReflectiveDependency(dep));
        } catch (e: unknown) {
            if (e instanceof InjectionError) {
                e.addKey(this, provider.key);
            }
            throw e;
        }

        try {
            return runInInjectionContext(this, provider.key.token, () => factory(...deps));
        } catch (e: any) {
            throw new InstantiationError(this, provider.key, { cause: e });
        }
    }

    private getByReflectiveDependency(dep: Dependency): any {
        if (dep.skip)
            return undefined;
        return this.getByKey(dep.key, dep.visibility, dep.optional ? null : THROW_IF_NOT_FOUND);
    }

    private getByKey(key: Key, visibility: SelfAnnotation | SkipSelfAnnotation | null, notFoundValue: any): any {
        // tslint:disable-next-line:no-use-before-declare
        if (key === Key.get(Injector)) {
            return this;
        }

        if (visibility instanceof SelfAnnotation) {
            return this.getByKeySelf(key, notFoundValue);
        } else {
            return this.getByKeyDefault(key, notFoundValue, visibility);
        }
    }

    private getByKeyId(keyId: number): any {
        for (let i = 0; i < this.keyIds.length; i++) {
            if (this.keyIds[i] === keyId) {
                if (this.instances[i] === UNDEFINED) {
                    this.instances[i] = this.construct(this._providers[i]);
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
    private getByKeyDefault(key: Key, notFoundValue: any, visibility: SelfAnnotation | SkipSelfAnnotation | null): any {
        let injector = visibility instanceof SkipSelfAnnotation ? this._parent : this;

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
     * var injector = ReflectiveInjector.resolveAndCreate([Car, Engine]);
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
     * Extract the dependencies of the given providers
     * @param providers 
     */
    static reflectDependencies(provider: Provider): ProviderWithDependencies {
        if (isTypeProvider(provider)) {
            provider = {
                provide: provider,
                useClass: <ConcreteType<any>>provider
            };
        }

        if (!('useClass' in provider))
            return provider;

        let classProvider: ClassProvider = <any>provider;

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

                let dep: any = token;

                if (skipAnnotation) {
                    dep = [Skip, token]
                } else if (optionalAnnotation) {
                    dep = [Optional, token];
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
    static fromResolvedProviders(providers: ResolvedProvider[], parent: Injector | null = null): Injector {
        // tslint:disable-next-line:no-use-before-declare
        return new Injector(providers, parent);
    }

}
