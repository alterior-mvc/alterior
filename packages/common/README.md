# @alterior/common

[![Version](https://img.shields.io/npm/v/@alterior/common.svg)](https://www.npmjs.com/package/@alterior/common)

Provides a number of base classes, utilities, and errors which are useful in constructing larger applications.

## `class Base64`

Simple, lightweight, portable base64 encoding and decoding. Good isomorphic alternative to `atob()` or Node.js' `Buffer` class.

```typescript
Base64.encode('hello world') // => "aGVsbG8gd29ybGQ="
Base64.decode('aGVsbG8gd29ybGQ=') // => "hello world"
```

## `class Cache<T>`

Provides a simple in-memory cache with ergonomic APIs for fetching. Handles expiration and eviction.

```typescript
let cache = new Cache<number>(/* timeToLive */ 1000, /* maxItems */ 100);
cache.fetch('some key', async () => await someExpensiveMethod());
```

## `clone()`

Use `clone()` to create a serialized clone of the given object. This is implemented as passing to JSON and back.

## `coalesce()`

Select the first _defined_ value within the given parameters. 

```typescript
let a = undefined;
let b = 123;
let c = 321;

coalesce(a, b, c) // => 123
```

## `class ConsoleColors`

Wrap strings in standard terminal ANSI colors.

```typescript
console.log(ConsoleColors.green('All good!')) // => a green 'All good!' message on the screen
```

## `interceptConsole()`

Augment, replace, or mute the functionality of the builtin Javascript `console` only for the code you are executing using the power of Zone.js. Code outside of your callback (even when it interrupts your 
callback due to an asynchronous call) are unaffected by the interception.

```typescript
interceptConsole((method, original, console, args) => {
    original(`${args.join(' ')} world!`);
}, () => {
    console.log(`Hello`);
}) 

// => prints "Hello world!"
```

## `indentConsole()`

A convenience function built from `interceptConsole()` that simply indents all console output by the
given number of spaces.

```typescript
indentConsole(4, () => {
    console.log("Hello\nWorld");
})

// => prints "    Hello"
// => prints "    World"
```

## `class Environment`

Provides an injectable service which provides environment variables to your application. Will read from dotenv files as well.

## Errors

This package provides many fundamental error types that are intended for you to use to simplify development. The rest of 
Alterior also relies upon these.

### `class SystemError`

Base class for errors thrown by the system or framework

### `class ApplicationError`

Base class for errors thrown by your application

### `class ArgumentError<ValueT>`

An argument to a method or function was invalid. The argument name can be obtained with `argumentName`. THe invalid value can be obtained with `value`

### `class ArgumentNullError`

The given argument was null and this is not allowed in this context.

### `class ArgumentOutOfRangeError`

The given argument is out of the expected range.


### `class NotSupportedError`

The current system, framework version, application, or configuration does not support the attempted operation.

### `class NotImplementedError`

The attempted operation is not implemented in this context.

### `class OperationCanceledError`

The operation was cancelled.

### `class TimeoutError`

The operation was interrupted due to a timeout. 

### `class IOError`

An error occurred while performing an IO operation

### `class FormatError`

An error occurred while formatting a provided value

### `class InvalidOperationError`

The attempted operation is invalid in the current state

### `class AccessDeniedError`

The attempted operation cannot be called given the current 
authorization and authentication state.

### `HttpError`

An HTTP operation failed with a non-successful response.

## `class LazyPromise<T>`

Create a promise which only starts doing work if an observer calls `.then()` or `.catch()`.

```typescript
let promise = new LazyPromise<T>(async () => {
    console.log("Called (once) only if an observer is interested in the result of the promise!");
    return 123;
});
```

## `class Lock`

Provides an asynchronous lock which can be used to ensure non-overlapping execution. All calls to `run()` are enqueued and then executed in order as the previous executions complete.

```typescript
let lock = new Lock();
lock.run(async () => {
    await timeout(1000);
    console.log("Hello");
});
lock.run(async () => {
    console.log("World!");
});

// => prints "Hello"
// => prints "World!"
```

If you need to synchronize code executions where sharing a `Lock` instance is inconvenient,
it is also possible to define a lock by specifying a "token" value. All locks which share the 
same token value will execute without overlap.

```typescript
let lock = Lock.forToken(123);
lock.run(() => {
    await timeout(1000);
    console.log('Hello')
});
let lock2 = Lock.forToken(123);
lock2.run(() => {
    console.log('World!')
});

// => prints "Hello"
// => prints "World!"
```

## `class ZoneLock`

An enhanced version of `Lock` which will run target functions in `AsyncZones` and ensure that 
all async operations are fully complete before allowing the next execution to happen (even if that 
async operation is not tracked by a promise, or the promise is not curried via a return)

```typescript
let lock = new ZoneLock();
lock.run(() => {
    setTimeout(() => console.log("Hello"), 1000);
});
lock.run(() => {
    console.log("World!");
});

// => prints "Hello"
// => prints "World!"
```

`ZoneLock` also supports token-based locks with `ZoneLock.forToken()` (see `Lock.forToken()` for more information).

## `prepareForSerialization(data : T): T`

Prepares objects and data for serialization across the wire. 
Collapses `undefined` into `null`, calls `toJSON()` if defined, 
filters all functions out of the object, and recursively calls 
`prepareForSerialization()` on all child values.

```typescript
prepareForSerialization({
    foo: 1,
    thisExists: undefined,
    increment() {
        this.foo += 1;
    },
    bar: {
        baz: "zzz",
        sayHi() {
            console.log('Hi!');
        }
    }
})

// => yields
// {
//   foo: 1,
//   thisExists: null,
//   bar: {
//     baz: 'zzz'
//   }
// }
```

## `timeout()`

Use this to get a promise for a timeout interval.

```typescript
await timeout(1000); // => waits 1000ms
```

## `class AsyncZone`

A simpler way to use Zone.js to monitor the execution of an async operation, even without promises.
The easiest way to use it is to call `AsyncZone.run()`:

```typescript
await AsyncZone.run(() => setTimeout(() => console.log('Hello'), 1000));
console.log('World!');

// => prints "Hello"
// => prints "World"
```

You can also instantiate AsyncZone directly and subscribe to the `onStable` and/or `onError` observables:

```typescript
let zone = new AsyncZone();
zone.onStable.subscribe(() => console.log('Code has finished executing!'))
zone.onError.subscribe(err => console.log(`Error thrown while executing code: ${err}`));
zone.invoke(() => myCode());
```

## `class Presentation<T>`

Allows for transforming data from one form to another using declarative rules.
To use, you must declare a subclass which has one or more properties annotated
with the `@Expose()` decorator. When the presentation is converted to JSON,
the property values from the `instance` given during instantiation will be used
within the JSON. If any property declaration within the `Presentation<T>` subclass
has a property type annotation for a type that extends `Presentation<T>`, a 
new instance of that type will be constructed and passed the property value from
the given `instance`. This allows you to control the presentation of subobjects.

For example:

```typescript
export class ApiUser extends Presentation<User> {
     @Expose() username : string;
     @Expose() profile : ApiProfile;
     // other properties of `User`, such as `hashedPassword`, will be
     // omitted in the final JSON.
}

export class ApiProfile extends Presentation<Profile> {
     @Expose() displayName : string;
     @Expose() firstName : string;
     // ...
}
```

To define a "virtual" value or override the value of the underlying `instance`,
use a standard getter (`get()`):

```typescript
export class ExampleOfVirtualProperties extends Presentation<Profile> {
     @Expose() get myProperty() {
         return 'look ma, virtual!'
     }
}
```

You can "augment" a value as well by accessing the underlying property with
`this.instance`:

```typescript
export class ExampleOfTransformedProperties extends Presentation<Profile> {
     @Expose() get myProperty() {
         return `The underlying value was: ${this.instance.myProperty}`;
     }
}
```

You may wish to pass additional objects into the presentation so they
can be used to compose the result. Simply override the base constructor 
to do so:

```typescript
export class ApiMedia extends Presentation<MediaSnippet> {
     constructor(
         instance : MediaSnippet, 
         readonly details : MediaDetails
     ) {
         super(instance)
     }

     @Expose() get assetUrl() {
         return this.details.assetUrl;
     }
}
```

If you need to use such a presentation within another presentation, you would
need to specify the value to use. A simple example might look like:

```typescript
export class ApiArtist extends Presentation<Artist> {
     constructor(
         instance : Artist, 
         readonly featuredMediaSnippet : MediaSnippet,
         readonly featuredMediaDetails : MediaDetails
     ) {
     }

     @Expose() get featuredMedia() : ApiMedia {
         return new ApiMedia(this.featuredMediaSnippet, this.featuredMediaDetails);
     }
}
```

You can also expose a property using the value of a different property on the 
underlying `instance`:

```typescript
export interface Movie {
     theTitle : string;
     // ...
}

export class ApiMovie extends Presentation<Movie> {
     @Expose({ useProperty: 'theTitle' }) title : string;
}
```

You can also specify a default value. It will be used when the 
value provided by the `instance` is `null` or `undefined`. 

```typescript
export class ApiMovie extends Presentation<Movie> {
     @Expose({ defaultValue: '(Not available)' }) audienceRating : string;
}
```

## `lazySubject({ start:..., stop:... })`

Returns an observable which causes the provided `start` function to be called when the observable transitions from having
no subscribers to having subscribers, and calls the provided `stop` function when the last subscriber unsubscribes.

This can be useful to implement lazy loading and other "connect on demand" strategies. If no one is around to subscribe
to a tree observable in the forest, does anyone hear it fall?