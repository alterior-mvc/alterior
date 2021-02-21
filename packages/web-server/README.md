# @alterior/web-server

[![Version](https://img.shields.io/npm/v/@alterior/web-server.svg)](https://www.npmjs.com/package/@alterior/web-server)

A framework for building HTTP services in Typescript. Build REST APIs with this. 

## Getting started

Install the Alterior runtime, the DI library, and the web-server module:

```
npm install reflect-metadata
npm install @alterior/runtime @alterior/di @alterior/web-server
```

## Configuring Typescript 

You must enable `enableExperimentalDecorators` and `emitDecoratorMetadata`,
and `esModuleInterop` Typescript compiler options to use this library. Do
this within `tsconfig.json`:

```json
{
    "compilerOptions": {
        "enableExperimentalDecorators": true,
        "emitDecoratorMetadata": true,
        "esModuleInterop": true
    }
}
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

You can delegate parts of your web service to dedicated controllers by mounting them within your main service class. Doing so will route specific URLs to specific controllers. Any controller can `@Mount()`, providing an intuitive way to construct a complete web service from a tree of controllers:

```typescript
@WebService(...)
export class MyWebService implements OnInit {
    @Mount('/users')
    usersController : UsersController;

    @Mount('/some-plugin')
    somePlugin : SomePluginController;
}
```

When you nest controllers using `@Mount()`, each subcontroller inherits the path prefix defined by all parents:

```typescript

@Controller('/f')
class SubSubController {
    @Get('/g')
    get() {
        return { message: 'you requested: GET /a/b/c/d/e/f/g' };
    }
}

@Controller('/c')
class SubController {
    @Get('/d')
    get() {
        return { message: 'you requested: GET /a/b/c/d' };
    }

    @Mount('/e')
    subsub : SubSubController;
}

@Controller('/a')
class MainController {
    @Mount('/b')
    sub : SubController;
}
```

Note: You do not always have to specify a path for `@Controller()`, `@Mount()` or `@Get()`, we have done so here for to keep the example clear. If you omit a path or set it to `''`, the element will not contribute any path segments to the final path registered for your routes.

## Mechanics of `@WebService`

`@WebService()` declares the class as a module (`@Module()`) and registers itself as a controller class (`@Controller()`) 
within that module. You can pass any of the options for `@Module()` and `WebServerModule.configure(...)`.

The following definition is equivalent to using `@WebService(options?)`:

```typescript
@Module({
    ...options,
    controllers: [ MyWebService ],
    imports: [ WebServerModule.configure(options) ]
})
@Controller()
export class MyWebService { /* ... */ }
```

For a larger application, you may wish to separate your 
top-level module from your web service implementation, especially when your application serves multiple roles. 

```typescript
// app.module.ts
import { Module } from '@alterior/di';
import { WebServerModule } from '@alterior/web-server';
import { FooController } from './foo.controller';

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
    /**
     * Every method is a web request. This one is "GET /simple".
     */
    @Get('/simple')
    public canBeSimple(ev : RouteEvent)
    {
    	return { status: 'success!' };
    }
    
    /**
     * You can also return promises.
     */
    @Get('/promises')
    public canUsePromises()
    {
        return Promise.resolve({ nifty: 123 });
    }
    
    /**
     * Or use async/await (the recommended way!)
     */
    @Get('/async')
    public async canUseAsync()
    {
    	return await someFunction();
    }
    
    /**
     * The parameters specified by your route methods are automatically 
     * analyzed, and the correct value is provided depending on what type 
     * (and in some cases what name) your parameter has.
     *
     * For example, you can receive path parameters.
     */
    @Get('/cars/:nameOfCar')
    public canUseRouteParams(nameOfCar : string)
    {
        return `you asked for car named ${nameOfCar}`;
    }

    /**
     * You can access the HTTP request and response using RouteEvent.request and 
     * RouteEvent.response if needed.
     */
    public useRouteEvents() {
        RouteEvent.response.status(200).send(`hello ${RouteEvent.request.header('user-agent')}`);
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
	    return Response.serverError({ 
            message: `uh oh, that's never happened before` 
        });
    }
    
    /**
     * You can even specify middleware directly on a route method...
     */
    @Get('/middlewareRocks', {
        middleware: [ myGreatMiddleware(someParameters) ]
    })
    public middlewareRolls(req : express.Request, res : express.Response)
    {
	    return Response.serverError({ 
            message: `uh oh, that's never happened before` 
        });
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

Alterior uses the following rules to fulfill the declared method parameters:

- Parameters decorated with `@PathParam('a')` will be fulfilled with the value 
  of path parameter `:a` from the route path (as in `/some/path/:a`). The 
  path parameter can be defined in any parent controller/mount context.
- Parameters decorated with `@QueryParam('q')` will be fulfilled with the query 
  parameter `q` if provided (`?q=...`) 
- Parameters decorated with `@Request('abc')` will be fulfilled with the request
  field `abc` if provided by the Connect engine or a preceding middleware.
- Parameters which are named `body` or decorated with `@Body()` will be fulfilled 
  with the value of `request.body`. You must use a body parsing middleware 
  (we recommend `body-parser`) to populate `request.body`.
- Parameters which are decorated with `Session('user')` will be populated with 
  the `user` key of the current session object.

> Note: If a path parameter is defined directly in the path passed to `@Get()` 
  decorator and an (otherwise unfulfilled) parameter with the same name is 
  defined on the method, the method parameter is fulfilled with the path parameter
  for the current request. Method parameters meant to be fulfilled from any 
  parent controller/mount-defined parameters must be decorated with `@PathParam()`

When combined with value returns, you can achieve a very natural style:  

```typescript
import * as bodyParser from 'body-parser';

interface MyRequestType {
	action : string;
	foo? : number;
}

@Controller()
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

Alterior supports Connect middleware (as used in Express, Fastify, etc). Middleware can be connected globally or 
declared as part of a route. 

To add middleware globally you can declare the `middleware` property on your `@WebService` or via 
`WebServerModule.configure()`.

```typescript
import * as myConnectMiddleware from 'my-connect-middleware';
@WebService({
    middleware: [myConnectMiddleware()]
})
export class MyService {
    // ...
}
```

You can also connect middleware globally, but limit it to specific paths:

```typescript
import fileUpload = require('express-fileupload');

@WebService({
    middleware: [
        ['/files', fileUpload]
    ]
})
export class MyService {
    // ...
}
```

To add route-specific middleware:

```typescript
@Get('/foo', { middleware: [fileUpload] })
public getFoo() {
    // ...
}
```

Middleware is inherited from parent controllers when using `@Mount()`, 
you can use this to avoid repeating yourself when building more complex
services:

```typescript
    @Controller()
    class FeatureController {
        @Get() 
        get() {
            // corsExampleMiddleware runs for this and all requests on this
            // controller 

            return {
                service: 'feature'
            }
        }
    }

    @Controller('', { 
        middleware: [ 
            corsExampleMiddleware({ allowOrigin: '*' }) 
        ]
    })
    class ApiController {
        @Mount('/feature')
        feature : FeatureController;
    }
```

## Uncaught Exceptions

When an exception occurs while executing a controller route method (excluding HttpExceptions), Alterior will respond
with an HTTP 500 error. By default, exception information will be included with the response. If the caught exception 
has a `toString()` method, it will be executed and its return value will be sent. If it does not, the error object will
be included directly, being converted along with the rest of the response to JSON.

`throw new Error('This is the error text')` would produce:
```json
{
    "message":"An exception occurred while handling this request.",
    "error":"Error: This is the error text\n    at FooController.sampleRequest (music.js:36:29)"
}
```

`throw { foo: 'bar' }` would product:
```json
{"message":"An exception occurred while handling this request.","error":{"foo":"bar"}}
``` 

You can disable the inclusion of exception information in responses (and this is recommended for production).
To do so, set `WebServerOptions.hideExceptions` to `true`. The `error` field will then be excluded from 500 responses.

```json
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
@WebService({
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

## Testing

Use `teststrap()` to test endpoints in your web service. Since the caller and the server are in the same process, the actual HTTP server is skipped, with requests passed directly from the `teststrap()` test to an instance of your web service.

`teststrap()` uses [supertest](https://github.com/visionmedia/supertest) as its core testing mechanism. The type of values returned by `teststrap()` is `supertest.Supertest<supertest.Test>`.

```typescript
@WebService()
class ExampleService { 
    @Get('/')
    info() {
        return { name: 'example', version: '1.0' };
    }
}

// suite/it/describe are from razmin (https://github.com/rezonant/razmin)
// you could use any test framework to encapsulate the 
// teststrap() assertions.

suite(describe => {
    describe('ExampleService', it => {
        it('returns its name', async () => {
            await teststrap(ExampleService)
                .get('/')
                .expect(200, { name: 'example', version: '1.0' })
        });
    });
});
```

You can reuse a `teststrap()` test should you need to perform multiple requests in your tests:

```typescript
let test = teststrap(ExampleService);

await test.get('/')
    .expect(200, { name: 'example', version: '1.0' })
;

await test.get('/foo')
    .expect(200, { other: 123 })
;
```

`supertest` offers a number of convenient expectations, but sometimes you need to do something more complex:

```typescript
    import { expect } from 'chai';

    let res : express.Response = await teststrap(ExampleService)
        .get('/')
        .expect(200)
    ;

    expect(res.body).to.contain({ name: })
```

For more information about the capabilities of `teststrap()`, consult the [supertest documentation](https://github.com/visionmedia/supertest).
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

## Deploying to a Cloud Function

You can deploy an Alterior web service as a Cloud Function (Google Cloud Functions, AWS Lambda, or other Function-as-a-Service (FaaS) providers) using `WebServer.bootstrapCloudFunction()`:

```typescript
// main.ts

import { MyWebService } from './my-web-service';
import { WebServer } from '@alterior/web-server';

export const cloudFunction = WebServer.bootstrapCloudFunction(MyWebService);
```

`bootstrapCloudFunction()` will handle constructing a function which takes an Express `request` and `response` and routes the given `request` through the given Alterior web service module and populating data into `response`. This is suitable for exporting into a general cloud function environment like GCF or Lambda.