# Alterior

[![Build status on Travis CI](https://travis-ci.org/alterior-mvc/alterior.svg?branch=master)](https://travis-ci.org/alterior-mvc/alterior)
[![Join the chat at https://gitter.im/alterior-mvc/Lobby](https://badges.gitter.im/alterior-core/Lobby.svg)](https://gitter.im/alterior-mvc/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![npm version](https://badge.fury.io/js/%40alterior%2Fcore.svg)](https://www.npmjs.com/package/@alterior/core)

A framework for building HTTP services in Typescript. Build REST APIs with this. 

## Getting started

Before you begin, make sure to enable `emitDecoratorMetadata` and `experimentalDecorators` in 
your project's `tsconfig.json`.

Install the Alterior runtime, the DI library, and the web-server module:

```
npm install reflect-metadata
npm install @alterior/runtime @alterior/di @alterior/web-server
```

Create a module class:

```typescript
// app.module.ts

import { AppOptions } from '@alterior/runtime';
import { Module } from '@alterior/di';
import { WebServerModule } from '@alterior/web-server';
import { FooController } from './foo.controller';

@AppOptions({ name: 'My Application' })
@Module({
    imports: [ WebServerModule ],
    controllers: [ FooController ]
})
export class AppModule {
}
```

In order to implement URL routes, we need at least one controller. In order for a controller's routes to be recognized 
and included in your application's routes, you must declare a controller in a `@Module()` class, and you must import 
that module in another module that you want to use it in. Here, the `AppModule` is special in that it will be our _entry module_.

Now, let's create FooController, complete with a number of example routes so you can get an idea of the style:

```typescript
// foo.controller.ts

import { Controller, Get, RouteEvent } from '@alterior/core';
import * as express from 'express';

@Controller('/optional-prefix')
export class FooController {
    @Get('/simple')
    public simple(ev : RouteEvent)
    {
    	return { status: 'success!' };
    }
    
    /**
     * You can also return promises.
     */
    @Get('/promises')
    public canHazPromises()
    {
        return Promise.resolve({ nifty: 123 });
    }
    
    /**
     * Or use async/await (the recommended way!)
     */
    @Get('/async')
    public async canHasAsync()
    {
    	return await someFunction();
    }
    
    /**
     * The parameters specified by your route methods are automatically analyzed,
     * and the correct value is provided depending on what type (and in some cases what name)
     * your parameter has.
     *
     * For example, you can get access to the Express request and response by injecting RouteEvent.
     */
    @Get('/useRouteEvent')
    public canHazRouteEvent(ev : RouteEvent)
    {
        ev.response.status(200).send("/foo works!");
    }
    
    /**
     * You can also request the Express request/response explicitly (note that this is 
     * based on the parameter name, see below for more details about
     * route method parameters).
     */
    @Get('/bar')
    public bar(req : express.Request, res : express.Response)
    {
        return Promise.resolve({ nifty: 123 });
    }
    
    /**
     * Promises can reject with an HttpException to specify HTTP errors...
     */
    @Get('/error')
    public errorExample(req : express.Request, res : express.Response)
    {
        return Promise.reject(new HttpException(301, {message: "No, over there"}));
    }

    /**
     * Or return an Alterior Response object for more flexibility...
     */
    @Get('/specificResponse')
    public specificResponseAndSuch(req : express.Request, res : express.Response)
    {
	return Response.serverError({ message: `uh oh, that's never happened before` });
    }
    
    /**
     * You can even specify middleware directly on a route method...
     */
    @Get('/middlewareRocks', {
        middleware: [ myGreatMiddleware(someParameters) ]
    })
    public middlewareRolls(req : express.Request, res : express.Response)
    {
	return Response.serverError({ message: `uh oh, that's never happened before` });
    }
    
}
```

Finally, make an entrypoint file:

```typescript
// main.ts 

import 'reflect-metadata';

import { Application } from '@alterior/runtime';
import { AppModule } from './app.module';

Application.bootstrap(AppModule);
```

If you are doing microservices or tests, you may want to avoid having an extra controller class 
when it's not necessary. Also, there are certain routes (think /, /version, /health) which you may want to 
respond with some static responses but wouldn't really warrant having it's own controller with separate
dependencies from your "application", even in larger multi-controller services.

For these reasons, if you choose to, you can put your routes directly on a module class. In fact, here's an entire
Alterior web service in one file:

```typescript
import { Service } from '@alterior/web-server';

@Service({
    providers: []
})
export class MyWebService implements OnInit {
    @Get('/version')
    version() {
        return { version: "1.0.0" };
    }

    @Get('/')
    version() {
        return { hello: 'world' };
    }
}

Application.bootstrap(MyWebService);
```

Finally, you must bootstrap your application. Typically this is done in a `main.ts` entrypoint file, but could be done wherever or however you want to do it:

```typescript
import { Application } from './app';
import { bootstrap } from '@alterior/core';

bootstrap(Application);
```

Hint: This is a good place to bare-import your controllers when using automatic controller discovery as described above.

## Building your app

It is recommended to set your Typescript to target ES5, or do a compiler pass with an ES6 transpiler. Alterior does ship with an ESM build, so you can try it, but your mileage may vary. 

You can use any build system you want, but the standard Typescript compiler (ie `tsc`) is recommended. The NPM scripts used in `@alterior/core` to build and test the core library could easily be used to build and test an Alterior application. 

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

Parameters named `body` will be filled with the value of `request.body`, which is useful since you can set the type of the parameter to whatever you
need to, such as an interface describing the expected fields that clients can send (coupled with the appropriate Express body parsing middleware). When combined with value returns, you can achieve a very natural style:  

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

## `Response` class

Alterior includes a `Response` class that makes it easy to return a rich HTTP response from your method. You can use this instead of HTTP exceptions if you wish, so here's the same example using `Response`:

```typescript
	// Perhaps we couldn't contact a microservice needed to fulfill the request.
	return Response.badGateway({ message: "Service is not available" });
```

## Dependency Injection

Alterior supports dependency injection using the same pattern as with Angular's dependency injection system (via the excellent `injection-js` spinoff library). A number of injectable services are in the box- perhaps you need access to the Express application object to do something Alterior doesn't support:

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
 - `Injector` (from `injection-js`): Provides access to the injector which resolved your class's dependencies

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

This is Angular's dependency injector, so you can define your own services just as you would in Angular.
You can add providers at the bootstrap, or app-class levels.

## That's great but how do you pronounce this?

Alterior is pronounced like "ulterior" but with an A. We know it's not a proper word :-)
