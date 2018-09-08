# @alterior/web-server

[![npm version](https://badge.fury.io/js/%40alterior%2Fweb-server.svg)](https://www.npmjs.com/package/@alterior/web-server)

A framework for building HTTP services in Typescript. Build REST APIs with this. 

## Getting started

Install the Alterior runtime, the DI library, and the web-server module:

```
npm install reflect-metadata
npm install @alterior/runtime @alterior/di @alterior/web-server
```

## A minimal example

For simple use cases, you can build a web service using Alterior in a single file:

```typescript
import { WebService } from '@alterior/web-server';

@WebService({
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

## Building your app

Make sure to enable `emitDecoratorMetadata` and `experimentalDecorators` in your project's `tsconfig.json`.

## Delegation via Mounting

You can delegate parts of your web service to dedicated controllers by mounting them within your main service class. Doing so will 
route specific URLs to specific controllers. Any controller can also `@Mount()`, providing an intuitive way to construct a 
complete web service.

```typescript
@WebService(...)
export class MyWebService implements OnInit {
    @Mount('/users')
    usersController : UsersController;

    @Mount('/some-plugin')
    somePlugin : SomePluginController;
}
```

## Mechanics 

Mechanically, `@WebService()` declares the class as a module (`@Module()`), applies `@AppOptions()`, and registers itself as a controller class within that module. 
You can pass any of the options for `@Module()`, `@AppOptions()` as well as the options available for `WebServerModule.configure(...)`.

The following definition is equivalent to using `@WebService(options?)`:

```typescript
@AppOptions(options)
@Module({
    ...options,
    controllers: [ MyWebService ],
    imports: [ WebServerModule.configure(options) ]
})
export class MyWebService { /* ... */ }
```

For a larger application, you may wish to separate your 
top-level module from your web service implementation, especially when your application serves multiple roles. 

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

Note that we need to explicitly include the `WebServerModule` here. 
We can also configure that module here if desired:

```typescript 
    imports: [ WebServerModule.configure({ port: 1234, ... }) ]
```

Now, let's create `FooController`, complete with a number of example routes so you can get an idea of the style:

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
     * For example, you can get access to the Express request and response by injecting 
     * RouteEvent.
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

Finally, we would make a separate entry point ("main") file:

```typescript
// main.ts 

import 'reflect-metadata';

import { Application } from '@alterior/runtime';
import { AppModule } from './app.module';

Application.bootstrap(AppModule);
```

## Route Parameters

Alterior inspects the parameters of controller methods to determine what values to provide. 
First, parameters of type `RouteEvent` are fulfilled with an instance of that class which
contains the Express request and response objects:

```typescript
@Get('/do')
doThings(ev : RouteEvent) {
	ev.response.status(404).send("Not found.");
}
```

Parameters decorated with `@PathParam('a')` will be fulfilled with the value of path parameter `:a` from the route path. 

Parameters decorated with `@QueryParam('q')` will be fulfilled with the query parameter `q` if provided. 

Parameters which are named `body` or decorated with `@Body()` will be fulfilled with the value of `request.body`. You must use a body parsing middleware (we recommend `body-parser`) to populate `request.body`.

When combined with value returns, you can achieve a very natural style:  

```typescript
import * as bodyParser from 'body-parser';

interface MyRequestType {
	action : string;
	foo? : number;
}

@Controller({ middleware: [ bodyParser.json() ] })
export class MyController {
    @Get('/do/:action')
    doThings(
        @Body() body : MyRequestType, 
        @PathParam('action') action : string, 
        @QueryParam('message') message : string
    ) {
        return {status: "success"};
    }
}
```

## `HttpError`

The `HttpError` class is included to signal Alterior to send certain HTTP status codes and responses back to the client when exceptional circumstances occur.

```typescript
	// Perhaps we couldn't contact a microservice needed to fulfill the request.
	throw new HttpError(502, "Service is not available");
```

## `Response`

Alterior includes a `Response` class that makes it easy to return any HTTP response from your method. You can use this instead of HTTP exceptions if you wish, so here's the same example using `Response`:

```typescript
	// Perhaps we couldn't contact a microservice needed to fulfill the request.
	return Response.badGateway({ message: "Service is not available" });
```

## Dependency Injection

Modules, controllers and services all participate in dependency injection. For more information about how DI works in Alterior apps, see the documentation for [@alterior/di](../di/README.md).

## Applying Middleware

Since Alterior uses Express (https://expressjs.com/), it supports any Express-compatible or Connect based middleware. Middleware can be used globally, it can be mounted to a specific set of URLs,  or it can be declared as part of a route, just like you can with vanilla Express.

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

To declare a service, simply mark it with `@Injectable()` from `@alterior/di` and then include it in the `providers` list of one of the Alterior module definitions within your application. The service will be made available across your whole application.

## Accessing the Express instance

Perhaps you need access to the Express application object to do something Alterior doesn't support:

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
