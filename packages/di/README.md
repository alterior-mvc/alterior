# @alterior/di

[![Version](https://img.shields.io/npm/v/@alterior/di.svg)](https://www.npmjs.com/package/@alterior/di)

Alterior supports dependency injection using the same patterns as in 
Angular applications. `@alterior/di` is responsible for providing the
underlying dependency injection mechanism.

Injectors created via this library are _heirarchical_. This is an 
important concept which is used throughout the Alterior framework. 
Injectors provide the dependencies specified when they are resolved
and if no matching dependency is found, the request is forwarded 
to the parent injector.

```typescript
import { ReflectiveInjector, Injectable } from '@alterior/di';

@Injectable()
class TestService {
    constructor(readonly date : Date) {
    }

    hello() {
        console.log(`Hello! The time is ${this.date.toString()}`);
    }
}

let injector = ReflectiveInjector.resolveAndCreate([
    { provide: 'Test', useValue: 123 },
    { provide: Date, useValue: new Date() },
    TestService
]);

console.log(injector.get('Test'));
console.log(injector.get(Date));
injector.get(TestService).hello();
```

## Injectors

The `Injector` class is abstract. It has exactly one exposed method:
`get(token : any) : any`. The library ships with `ReflectiveInjector`
which uses Typescript's runtime type reflection (requires `emitDecoratorMetadata`) in order to determine which dependencies are 
requested by a constructor function. Because Typescript only emits 
type metadata for elements which are annotated with a decorator, you 
must decorate any class that participates in DI with the `@Injectable()`
decorator. Since the mere presence of a decorator causes metadata to be 
emitted, you do not need `@Injectable()` if there is any other decorator 
already applied, but it is good practice to include it nonetheless.

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
it in a useClass Provider object. Doing so with class `ABC` is the equivalent of specifying `{ provide: ABC, useClass: ABC }`

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