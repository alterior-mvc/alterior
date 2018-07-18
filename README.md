# Alterior

[![Build status on Travis CI](https://travis-ci.org/alterior-mvc/alterior.svg?branch=master)](https://travis-ci.org/alterior-mvc/alterior)
[![Join the chat at https://gitter.im/alterior-mvc/Lobby](https://badges.gitter.im/alterior-core/Lobby.svg)](https://gitter.im/alterior-mvc/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![npm version](https://badge.fury.io/js/%40alterior%2Fcore.svg)](https://www.npmjs.com/package/@alterior/core)

An Express-based Typescript MVC framework using decorators and Angular 2 dependency injection.

## Getting started

Need a sample project? See [Alterior Quickstart](https://github.com/alterior-mvc/quickstart)

Install the package:
```
npm install @alterior/core
```

Create an application class (usually in `app.ts`):

```typescript
import 'reflect-metadata';
import { OnSanityCheck, OnInit, AppOptions } from '@alterior/core';

export class Application implements OnSanityCheck, OnInit {
    public altOnSanityCheck(): Promise<boolean> {
    	// Perform "health" checks like connecting to database, etc
		// When your app is called with 'test' as first argument,
		// Alterior will execute this and exit with code 0 on success,
		// code 1 on error. You could then use this as a prestart check
		// during deployment
    	return Promise.resolve(true);
    }
    
    public altOnInit() {
        console.log('Service is started!');
    }
}
```

Create a controller (let's say `foo.ts`):

```typescript
import { Controller, Get, RouteEvent } from '@alterior/core';
import * as express from 'express';

@Controller('/optional-prefix')
export class FooController {
    @Get('/foo')
    public foo(ev : RouteEvent)
    {
        ev.response.status(200).send("/foo works!");
    }
    
    /**
     * You can also return promises, or 
	 * request the Express request/response explicitly (note that this is 
	 * based on the parameter name, see below for more information about
	 * route method parameters.  
     */
    @Get('/bar')
    public bar(req : express.Request, res : express.Response)
    {
        return Promise.resolve({ nifty: 123 });
    }
    
    @Get('/error')
    public errorExample(req : express.Request, res : express.Response)
    {
		//  Promises can reject
        return Promise.reject(new HttpException(301, {message: "No, over there"}));
    }

    @Get('/error')
    public errorExample(req : express.Request, res : express.Response)
    {
		// Values are OK too
        return { nifty: 123};
    }
}
```

Import your controller at the top of `app.ts`. By default, all classes with the @Controller() decorator 
declared throughout your application will be automatically registered in your application, but you have 
to ensure that your class is imported for it to work. You can override this behavior by specifying 
`autoRegisterControllers: false` in your application's `@AppOptions` decorator. If you do so, only the 
controllers you specify in the `controllers` array of `@AppOptions` will be included in your application. 

When using automatic discovery, the simplest way to ensure a controller gets loaded is with:

```typescript
import "foo";
```

If you are doing microservices or tests, you might want to avoid having an extra single controller class 
when it's not necessary. Also, there are certain routes (think /, /version, /health) which you may want to 
respond with some static responses but wouldn't really warrant having an entire controller with separate
dependencies from your "application", even in larger multi-controller services.

For these reasons, if you choose to, you can put your routes directly on your application class:  

```
export class Application {
    @Get('/version')
	version() {
		return { version: "1.0.0" };
	}
}
```

Finally, you must bootstrap your application. Typically this is done in a `main.ts` entrypoint file:

```typescript
import { Application } from './app';
import { bootstrap } from '@alterior/core';

bootstrap(Application);
```

## Building your app

Note: For the time being, it is recommended to set your Typescript to target ES5, or do a compiler pass
with an ES6 transpiler before running your app in the newer Node.js versions which are otherwise capable 
of it. If you target ES6 you will get an error related to Angular calling a class constructor without 
the `new` operator. This happens when Angular tries to instantiate an ES6 class. Node.js doesn't 
currently allow the manner of object construction Angular is using. Angular 2 needs to be changed to use 
[`Reflect.construct`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/construct) when available. 
It's a known issue, and it has yet to be resolved upstream, unfortunately. 

You can use any build system you want, but this works well with standard `tsc` compilation (ie, JS alongside TS). The NPM scripts used in `@alterior/core` to build and test the core library could easily be used to build and test an Alterior application. 

You can test your app however you want as well, but there is a smooth way to do it with `supertest`, `mocha`, and `mocha-typescript` from NPM. You can see this style of testing used in this repository (`lib/**/*.test.ts`).

## Route Parameters

Alterior inspects the parameters of controller methods to determine what values to provide. Firstly, parameters of type `RouteEvent` will be provided with an instance of that class which
contains the Express request and response objects.

```typescript
@Get('/do')
doThings(ev : RouteEvent) {
	ev.response.status(404).send("Not found.");
}
```

Alternatively, parameters which are named `request` or `req` will also be fulfilled with the Express request. Likewise, `response` or `res` 
can be used to get the response object. Note that using `RouteEvent` is preferred and recommended since it is a type-based rule. 

```typescript
@Get('/do')
doThings(req : express.Request, res : express.Response) {
	res.status(404).send("Not found.");
}
```

Also, parameters named `body` will be filled with the value of `request.body`, which is useful since you can set the type of the parameter to whatever you
need to, such as an interface describing the expected fields that clients can send. When combined with value returns, you can achieve a very natural style:  

```typescript
interface MyRequestType {
	action : string;
	foo? : number;
}

@Get('/do')
doThings(body : MyRequestType) {
	return {status: "success"};
}
```

## HTTP Exceptions

The `HttpException` class is included to signal Alterior to send certain HTTP status codes and responses back to the client when exceptional circumstances occur.

```typescript
	// Perhaps we couldn't contact a microservice needed to fulfill the request.
	throw new HttpException(502, "Service is not available");
```

## Dependency Injection

Alterior supports dependency injection using Angular 2's dependency injector. A number of injectable services are 
in the box- perhaps you need access to the Express application object to do something Alterior doesn't support:

```typescript
import 
@Controller()
export class FooController {
    constructor(
        private expressRef : ExpressRef
    ) {
        this.expressApp = expressRef.application;
        this.expressApp.get('/something', (req, res) => {
            res.status(200).send('/something works!');
        });
    }
    
    private expressApp : express.Application;
}
```

Other builtin injectables include:
 - The Application class. You will be given the singleton instance of your Application class.
 - `ExpressRef`: Provides reference to the `express.Application` instance as configured for your application
 - `Injector` (from `@angular/core`): Provides access to the injector which resolved your class's dependencies

## Applying Middleware
Alterior is based on Express (https://expressjs.com/), so naturally it supports any Express or Connect based middleware. Middleware can be used globally, it can be mounted to a specific set of URLs,  or it can be declared as part of a route, just like you can with vanilla Express.

To add middleware globally you must use the `@AppOptions` decorator on your app class:

```typescript
import * as bodyParser from 'body-parser'; // you will need to load the body-parser typings for this syntax
@AppOptions({
    middleware: [bodyParser.json()]
})
export class Application {
    // ...
}
```

To add "mounted" middleware:

```typescript
const fileUpload = require('express-fileupload');

@AppOptions({
    middleware: [
        ['/files', fileUpload]
    ]
})
export class Application {
    // ...
}
```

To add route-specific middleware:

```typescript
    @Get('/foo', { middleware: [bodyParser.json()] })
    public foo(req : express.Request, res : express.Response) {
        // todo
    }
```

## Uncaught Exceptions

When an exception occurs while executing a controller route method (excluding HttpExceptions), Alterior will respond
with an HTTP 500 error. By default, exception information will be included with the response. If the caught exception 
has a `toString()` method, it will be executed and its return value will be sent. If it does not, the error object will
be included directly, being converted along with the rest of the response to JSON.

`throw new Error('This is the error text')` would produce:
```
{"message":"An exception occurred while handling this request.","error":"Error: This is the error text                                                                 
    at FooController.sampleRequest (music.js:36:29)"}
```

`throw { foo: 'bar' }` would product:

```
{"message":"An exception occurred while handling this request.","error":{"foo":"bar"}}
``` 

You can disable the inclusion of exception information in responses (and this is recommended for production).
To do so, set `AppOptions.hideExceptions` to `true`. The `error` field will then be excluded from 500 responses.

```
{"message":"An exception occurred while handling this request."}
``` 

## MongoDB integration

MongoDB integration is no longer bundled in. See [@alterior/mongo](https://github.com/alterior-mvc/alterior-mongo)

## Sessions

To add session support, use `express-session`:

```
npm i express-session --save
typings i dt~express-session --save
```

Include it as middleware:

```typescript
import * as session from 'express-session';
@AppOptions({
	middleware: [session({ secret: SESSION_SECRET })]
})
```

You can then use the session by requesting it as a parameter from your controller methods:

```typescript

interface SessionData {
	username : string;
	cartTotal : number;
}

@Controller()
class SampleController {
	@Get('/')
	home(session : SessionData) {
		return session.cartTotal;
	}
}
```

[Alterior Mongo](https://github.com/alterior-mvc/alterior-mongo) alternatively provides a MongoDB-based session provider based on `connect-mongo`,
or you can use any Express/Connect middleware that provides `request.session`.

## Custom services

This is Angular 2's dependency injector, so you can define your own services just as you would in Angular.
You can add providers at the bootstrap, or app-class levels.

## That's great but how do you pronounce this?

Alterior is pronounced like "ulterior" but with an A. We know it's not a proper word :-)
