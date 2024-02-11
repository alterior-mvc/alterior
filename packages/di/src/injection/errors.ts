import { stringify } from './stringify';
import { Type } from './type';

import { Injector } from './injector';
import { Key } from './key';

export abstract class InjectionError extends Error {
    constructor(
        injector: Injector,
        key: Key,
        options?: ErrorOptions
    ) {
        super(undefined, options);

        this.keys = [key];
        this.injectors = [injector];
    }

    //abstract get message(): string;

    readonly keys: Key[];
    readonly injectors: Injector[];

    addKey(injector: Injector, key: Key): void {
        this.injectors.push(injector);
        this.keys.push(key);
    }

    protected findFirstClosedCycle(keys: any[]): any[] {
        const res: any[] = [];
        for (let i = 0; i < keys.length; ++i) {
            if (res.indexOf(keys[i]) > -1) {
                res.push(keys[i]);
                return res;
            }
            res.push(keys[i]);
        }
        return res;
    }

    protected constructResolvingPath(keys: any[]): string {
        if (keys.length > 1) {
            const reversed = this.findFirstClosedCycle(keys.slice().reverse());
            const tokenStrs = reversed.map(k => stringify(k.token));
            return ' (' + tokenStrs.join(' -> ') + ')';
        }

        return '';
    }

}

/**
 * Thrown when trying to retrieve a dependency by key from {@link Injector}, but the
 * {@link Injector} does not have a {@link Provider} for the given key.
 *
 * ```typescript
 * class A {
 *   constructor(b:B) {}
 * }
 *
 * expect(() => Injector.resolveAndCreate([A])).toThrowError();
 * ```
 */
export class NoProviderError extends InjectionError {
    get message() {
        const first = stringify(this.keys[0].token);
        return `No provider for ${first}${this.constructResolvingPath(this.keys)}`;
    }
}

/**
 * Thrown when dependencies form a cycle.
 *
 * ```typescript
 * var injector = Injector.resolveAndCreate([
 *   {provide: "one", useFactory: (two) => "two", deps: [[new Inject("two")]]},
 *   {provide: "two", useFactory: (one) => "one", deps: [[new Inject("one")]]}
 * ]);
 *
 * expect(() => injector.get("one")).toThrowError();
 * ```
 *
 * Retrieving `A` or `B` throws a `CyclicDependencyError` as the graph above cannot be constructed.
 */
export class CyclicDependencyError extends InjectionError {
    get message() {
        return `Cannot instantiate cyclic dependency${this.constructResolvingPath(this.keys)}`;
    }
}

/**
 * Thrown when a constructing type returns with an Error.
 *
 * The `InstantiationError` class contains the original error plus the dependency graph which caused
 * this object to be instantiated.
 *
 * ```typescript
 * class A {
 *   constructor() {
 *     throw new Error('message');
 *   }
 * }
 *
 * var injector = Injector.resolveAndCreate([A]);

 * try {
 *   injector.get(A);
 * } catch (e) {
 *   expect(e instanceof InstantiationError).toBe(true);
 *   expect(e.originalException.message).toEqual("message");
 *   expect(e.originalStack).toBeDefined();
 * }
 * ```
 */
export class InstantiationError extends InjectionError {
    get message() {
        const first = stringify(this.keys[0].token);
        return `${(this.cause as Error).message ?? 'Unknown error'}: `
            + `Error during instantiation of ${first}${this.constructResolvingPath(this.keys)}.`
            ;
    }
}

/**
 * Thrown when an object other then {@link Provider} (or `Type`) is passed to {@link Injector}
 * creation.
 *
 * ```typescript
 * expect(() => Injector.resolveAndCreate(["not a type"])).toThrowError();
 * ```
 */
export class InvalidProviderError extends Error {
    constructor(readonly provider: any) {
        super(`Invalid provider - only instances of Provider and Type are allowed, got: ${provider}`);
    }
}

/**
 * Thrown when the class has no annotation information.
 *
 * Lack of annotation information prevents the {@link Injector} from determining which dependencies
 * need to be injected into the constructor.
 *
 * ```typescript
 * class A {
 *   constructor(b) {}
 * }
 *
 * expect(() => Injector.resolveAndCreate([A])).toThrowError();
 * ```
 *
 * This error is also thrown when the class not marked with {@link Injectable} has parameter types.
 *
 * ```typescript
 * class B {}
 *
 * class A {
 *   constructor(b:B) {} // no information about the parameter types of A is available at runtime.
 * }
 *
 * expect(() => Injector.resolveAndCreate([A,B])).toThrowError();
 * ```
 */
export class NoAnnotationError extends Error {
    constructor(readonly subject: Type<any> | Function, readonly params: any[][]) {
        const signature: string[] = [];
        for (let i = 0, ii = params.length; i < ii; i++) {
            const parameter = params[i];
            if (!parameter || parameter.length === 0) {
                signature.push('?');
            } else {
                signature.push(parameter.map(x => stringify(x)).join(' '));
            }
        }

        super(
            `Cannot resolve all parameters for '${stringify(subject)}'(${signature.join(', ')}). `
            + `Make sure that all the parameters are decorated with Inject or have valid type annotations `
            + `and that '${stringify(subject)}' is decorated with Injectable.`
        )
    }
}

/**
 * Thrown when getting an object by index.
 *
 * ```typescript
 * class A {}
 *
 * var injector = Injector.resolveAndCreate([A]);
 *
 * expect(() => injector.getAt(100)).toThrowError();
 * ```
 */
export class OutOfBoundsError extends Error {
    constructor(readonly index: number) {
        super(`Index ${index} is out-of-bounds.`);
    }
}

// TODO: add a working example after alpha38 is released
/**
 * Thrown when a multi provider and a regular provider are bound to the same token.
 *
 * ```typescript
 * expect(() => Injector.resolveAndCreate([
 *   { provide: "Strings", useValue: "string1", multi: true},
 *   { provide: "Strings", useValue: "string2", multi: false}
 * ])).toThrowError();
 * ```
 */
export class MixingMultiProvidersWithRegularProvidersError extends Error {
    constructor(readonly provider1: any, readonly provider2: any) {
        super(`Cannot mix multi providers and regular providers, got: ${provider1} ${provider2}`);
    }
}