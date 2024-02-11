# @alterior/di

[![Version](https://img.shields.io/npm/v/@alterior/di.svg)](https://www.npmjs.com/package/@alterior/di)

Provides a flexible dependency injection system. The system provided here is used extensively throughout the 
Alterior framework, but you can use it independently as well.

Injectors created via this library are heirarchical. Along with a set of dependency injection providers, an injector 
can reference a "parent" injector. If no matching dependency is found, the request is forwarded to the parent injector.

```typescript
import { Injector, inject } from '@alterior/di';

class TestService {
    readonly date = inject(Date);
    hello() {
        console.log(`Hello! The time is ${this.date.toString()}`);
    }
}

const TEST = new InjectionToken<number>('Test');

let injector = Injector.resolveAndCreate([
    { provide: TEST, useValue: 123 },
    { provide: Date, useValue: new Date() },
    TestService
]);

console.log(injector.get(TEST));    // prints 123
console.log(injector.get(Date));    // prints the current date
injector.get(TestService).hello();  // Prints `Hello! The time is <current date>`

```

# Providers

An Injector is defined by a set of Providers. A Provider specifies an
injection token to be provided as well as the value which should be 
injected when the framework encounters the injection token. 

There are a variety of supported `Provider` types:
- **`TypeProvider`**: eg `MyClass`  
  The injector will satisfy `inject(MyClass)` by calling `new MyClass()`. This is equivalent to 
  specifying a class provider of `{ provide: MyClass, useClass: MyClass }`. The injection library will normalize these into class providers for you.

- **`ClassProvider`**: eg `{ provide: TOKEN, useClass: MyClass }`  
  The injector will satisfy `inject(TOKEN)` by constructing the given class using `new`.  

- **`ValueProvider`**: eg `{ provide: TOKEN, useValue: 123 }`  
  The injector will satisfy `inject(TOKEN)` with an existing value.

- **`FactoryProvider`**: eg `{ provide: TOKEN, useFactory: () => 123 }`  
  The injector will satisfy `inject(TOKEN)` with the result of invoking a factory function. You can 
  use `inject()` within the factory function to obtain any needed dependencies.

- **`ExistingProvider`**: eg `{ provide: TOKEN, useExisting: ANOTHERTOKEN }`  
  The injector will satisfy `inject(TOKEN)` with the same value as `inject(ANOTHER_TOKEN)`.

# Multi-Providers

Usually a dependency is resolved from a single provider. In some cases it may be helpful to allow multiple providers 
to contribute parts of a single dependency. To support that use case, you can mark the providers as `multi: true`. When
you do this, `inject(TOKEN)` will return an array containing the values of all the multi-providers.

# Forward References

In some cases (such as circular imports or non-hoisted definitions), the value of a given symbol may not be available 
until the entire source file (or both source files) have finished their initial execution. The injector library provides
a mechanism for dealing with this called "forward references". Forward references can be used in the `provide` and 
`useClass` provider properties, as well as for TypeProviders (ie `() => MyType`)

# Non-unique Providers

Class and factory providers are singleton-like by default; only one instantiation will be created. You can set the 
`unique` option to be `false` to cause a new instantiation to happen per injection. 

# Imperative Injection

The `inject()` method is the primary way to tell the injector what dependencies your class needs. This function can 
only be called while a dependency is being instantiated (ie, during a class's constructor or during the factory of a 
factory provider).

In addition to `inject()`, you can obtain the _injection context_ itself using `injectionContext()`. This grants you 
access to the injector itself as well as the token that is currently being instantiated.

# Injecting the Injector

All injectors are capable of providing the injector itself. While this might seem unnecessary, since 
`injector.get(token)` is equivalent to `inject(token)`, you may need to retain the injector for use after instantiation
is complete, or use it to create a child injector. 

Since Injectors are not directly constructable (you must use the `Injector.create()` family of methods), Typescript 
will not let you directly pass `Injector` to `inject()` as in:

```typescript
let injector = inject(Injector);
// -------------------^
//  Argument of type 'typeof Injector' is not assignable to parameter of type 'Type<Injector> | InjectionToken<Injector>'.
//   Type 'typeof Injector' is not assignable to type 'ConcreteType<Injector>'.
//     Cannot assign a 'private' constructor type to a 'public' constructor type.ts(2345)
```

We recommend using `injectionContext().injector` instead, which is type-safe.

# Creating Injectors

```typescript
let injector = Injector.resolveAndCreate([ /* providers */ ], parent?);
```

Use `resolveAndCreate()` to create a new injector. If you passed a parent 
injector to `resolveAndCreate()` then the tokens provided by the parent 
injector become available in the new injector (assuming they are not 
overridden).

# Getting Values

Once you've obtained an `Injector` you can use `Injector#get()` to obtain the value for a particular injection token:

```typescript
let instance = injector.get(MyClass);
```

If `MyClass` is not provided by the injector (or any of its parents)
an exception will be thrown. You can change this behavior by passing 
a second parameter to `get()`:

```typescript
const SOME_NUMBER = new InjectionToken<number>;
let number = injector.get(SOME_NUMBER, 999);
```

Here `number` will be `999` if `injector` does not provide `'SomeNumber'`.
You can use this to avoid throwing an exception if the value is not present:

```typescript
let instance = injector.get(MyClass, null);
```

Here `instance` will be `null` if `injector` does not provide `MyClass`. 
Note: You cannot pass `undefined` here as `get()` will act as if you 
did not pass the second parameter at all. Use `null` instead.

# Credit

This library was originally derived from the [`injection-js`](https://www.npmjs.com/package/injection-js) package, which is itself was originally derived from Angular 4's dependency injector.