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

let injector = Injector.resolveAndCreate([
    { provide: 'Test', useValue: 123 },
    { provide: Date, useValue: new Date() },
    TestService
]);

console.log(injector.get('Test'));  // prints 123
console.log(injector.get(Date));    // prints the current date
injector.get(TestService).hello();  // Prints `Hello! The time is <current date>`

```

## Providers

An Injector is defined by a set of Providers. A Provider specifies an
injection token to be provided as well as the value which should be 
injected when the framework encounters the injection token. 

There are a number of Provider types:
- **Value**: Specify an existing value that should be provided  
  `{ provide: 'TOKEN', useValue: 123 }`

- **Factory**: Define a factory function that will be called in order to create the value that should be provided  
  `{ provide: 'TOKEN', useFactory: () => 123 }`

- **Existing**: Define the provided value by specifying another injection token to resolve  
  `{ provide: 'TOKEN', useExisting: 'ANOTHERTOKEN' }`

- **Class**: The injector will instantiate the given class and use the new instance as the provided value  
  `{ provide: 'TOKEN', useClass: MyClass }`

As a shortcut, you can pass a constructor function (class) without wrapping 
it in a useClass Provider object. Doing so with class `ABC` is the equivalent of specifying 
`{ provide: ABC, useClass: ABC }`

## Non-unique Providers

Class and factory providers are singleton-like by default; only one instantiation will be created. You can set the 
`unique` option to be `false` to cause a new instantiation to happen per injection. 

## Imperative Injection

The `inject()` method is the primary way to tell the injector what dependencies your class needs. This function can 
only be called while a dependency is being instantiated (ie, during a class's constructor or during the factory of a 
factory provider).

In addition to `inject()`, you can obtain the _injection context_ itself using `injectionContext()`. This grants you 
access to the injector itself as well as the token that is currently being instantiated.

## Creating Injectors

```typescript
let injector = ReflectiveInjector.resolveAndCreate([ /* providers */ ], parent?);
```

Use `resolveAndCreate()` to create a new injector. If you passed a parent 
injector to `resolveAndCreate()` then the tokens provided by the parent 
injector become available in the new injector (assuming they are not 
overridden).

## Getting Values

Once you've obtained an `Injector` you can use `Injector#get()` to obtain the value for a particular injection token:

```typescript
let instance = injector.get(MyClass);
```

If `MyClass` is not provided by the injector (or any of its parents)
an exception will be thrown. You can change this behavior by passing 
a second parameter to `get()`:

```typescript
let number = injector.get('SomeNumber', 999);
```

Here `number` will be `999` if `injector` does not provide `'SomeNumber'`.
You can use this to avoid throwing an exception if the value is not present:

```typescript
let instance = injector.get(MyClass, null);
```

Here `instance` will be `null` if `injector` does not provide `MyClass`. 
Note: You cannot pass `undefined` here as `get()` will act as if you 
did not pass the second parameter at all. Use `null` instead.
