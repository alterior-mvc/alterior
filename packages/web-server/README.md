# @alterior/web-server

[![Version](https://img.shields.io/npm/v/@alterior/web-server.svg)](https://www.npmjs.com/package/@alterior/web-server)

A framework for building HTTP services in Typescript. Build REST APIs with this. 

# Getting started

Install the Alterior runtime, the DI library, and the web-server module:

```
npm install reflect-metadata
npm install @alterior/runtime @alterior/di @alterior/web-server
```

# Configuring Typescript 

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

# A minimal example

For simple use cases, you can build a web service using Alterior in a single file:

```typescript
// my-web-service.ts

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

# How do I run it?

Make an entry point for your application if you don't already have one:

```typescript
// main.ts 

import 'reflect-metadata';

import { Application } from '@alterior/runtime';
import { MyWebService } from './my-web-service';

Application.bootstrap(MyWebService);
```

After you compile your application using Typescript, run your app using Node.js:

```
node dist/main
```

You should use NPM scripts to manage building, testing and running your application per the conventions of the Node.js community.

# Mechanics of `@WebService`

When classes marked `@WebService()` are bootstrapped as part of an Alterior application (via `Application#bootstrap()`), a new Alterior role is registered with [`RolesService`](../runtime/README.md#roles) which is responsible for starting up and shutting down a web server using one of the supported WebEngines (currently Express and Fastify). The class itself acts both as a `@Module()` and the root `@Controller()` of the service. The class can then use `@Mount()` to add additional controllers to the service. Each `@WebService()` has its own separate server instance, which means you can host multiple web services (on different ports) within the same overall application. Each service will be given its own role which can be controlled independently.

# Delegation via Mounting

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

When you nest controllers using `@Mount()`, each subcontroller inherits the path prefix defined by all parents, like below:

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

# When to use base paths with @Mount

To ensure your app is easy to maintain as it grows, we recommend that you design your mounted controllers to operate from the root of your web service. This means omitting a base path when using `@Mount()`. Doing so ensures that you will not need to rewrite all of your route definitions if you need to add a route that falls outside of your controller's expected base path.

Passing a base path can be useful however when consuming a controller which is intended to be consumed by many web services.

# Promises & Async
```typescript
/**
 * You can return promises. Alterior will wait for the promise to resolve
 * before responding to the HTTP request.
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
```

# Path Parameters

The parameters specified by your route methods are automatically 
analyzed, and the correct value is provided depending on what type 
(and in some cases what name) your parameter has.

For example, you can receive path parameters. Alterior knows that 
since you have a path parameter named `nameOfCar` and an otherwise 
undecorated method parameter also named `nameOfCar` that these two are 
related 

```typescript
@Get('/cars/:nameOfCar')
public canUseRouteParams(nameOfCar : string)
{
    return `you asked for car named ${nameOfCar}`;
}
```

# Accessing the Request/Response

Sometimes you need to check or set an HTTP header, interact directly with middleware, or handle parsing the request body or serializing the response body yourself. Alterior lets you do that using the `WebEvent` class. 

```typescript
@Get()
public whoAmI() {
    WebEvent.response.status(200).send(`hello ${WebEvent.request.header('user-agent')}`);
}
```

## Is this done via global variables? Wouldn't that not work with async requests?

`WebEvent` uses Zone-local variables to accomplish its task, so there is no risk that you will access the wrong request/response when using it unlike when global variables are used for this purpose. 

# Complex Responses

The recommended way to handle HTTP error statuses is using the `HttpException` class. You can throw the exception from your route method and Alterior will recognize this and fulfill the HTTP response as you specify.

```typescript
/**
 * Promises can reject with an HttpException to specify HTTP errors...
 */
@Get('/error')
public async errorExample()
{
    throw new HttpException(301, {message: "No, over there"}));
}
```

For successful responses, throwing HttpException (while supported) is not idiomatic. Instead you should return a special response value from your method using the `Response` class

```typescript
@Get()
public responseExample()
{
    return Response.movedPermanently('https://example.com/');
}
```

# Parameters Matching

Alterior inspects the parameters of controller methods to determine what values need to be provided while handling a request. 

- Parameters decorated with `@PathParam('a')` will be fulfilled with the value 
  of path parameter `:a` from the route path (as in `/some/path/:a`). The 
  path parameter can be defined in any parent controller/mount context. Since path parameters are the most common, 
  and there is a high degree of linkage between path parameters and method parameters, you can omit `@PathParam()` if 
  the name of your path parameters is the same as your method parameter as shown above
  
  > Note: If a path parameter is defined directly in the path passed to `@Get()` 
  decorator and an (otherwise unfulfilled) parameter with the same name is 
  defined on the method, the method parameter is fulfilled with the path parameter
  for the current request. Method parameters meant to be fulfilled from any 
  parent controller/mount-defined parameters must be decorated with `@PathParam()`

- Parameters decorated with `@QueryParam('q')` will be fulfilled with the query 
  parameter `q` if provided (`?q=...`). If the query parameter was not provided in the request, the value of the 
  parameter will be `undefined`.
- Parameters decorated with `@QueryParams()` will be fulfilled with an object containing all query parameters found
  within the URL. The type of this object is effectively `Record<string,string>`, but you can use any interface type
  for the parameter for convenience purposes.
  > Note: No coercion of parameter types is performed- all values within the `@QueryParams()` object will be 
  > strings
- Parameters which are decorated with `@Body()` will be fulfilled 
  with the value of `WebEvent.request.body`. If the type of the method parameter is `string`, Alterior will 
  automatically connect a text body parsing middleware (`bodyParser.text()`). If the type of the method parameter is 
  `Buffer`, Alterior will automatically connect a raw body parsing middleware (`bodyParser.raw()`). For any other 
  parameter type, Alterior adds a JSON body parsing middleware (`bodyParser.json()`). If you need other body parsing 
  middleware, you can add it directly to the `middleware` property of the route decorator's `options` parameter and use 
  `WebEvent.request.body` directly instead.

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

# WebSockets

WebSocket support is built in. You can call `WebServer.startSocket()` while handling a request to upgrade the current request into a WebSocket connection.

```typescript
@Get()
mySocket() {
    let socket = WebServer.startSocket();
    socket.addEventListener('message', ev => {
        console.log(`Received message from client: ${ev.data}`);
    });
}
```

# TLS (HTTPS)

Typically it is best to terminate HTTPS at a reverse proxy running on the same machine as your application server, or at an external load balancer. However Alterior does allow you to do it within the application server (which is required for native HTTP/2)

```typescript
@WebService({
    server: {
        certificate: `---BEGIN...`,
        privateKey: `---BEGIN...`,
        port: 443
    }
})
export class MyService {
    // ...
}
```

# HTTP/2

HTTP/2 support is built-in. Specify `protocols` to enable it. If you provide a TLS certificate HTTP/2 is enabled by default. Otherwise only HTTP is enabled. However, if you add `h2` (or one of the `spdy/*` versions) to `protocols` but you do not specify a TLS certificate, then Alterior will automatically generate and use a self-signed certificate which is useful for testing HTTP/2 services in development.

```typescript
@WebService({
    server: {
        protocols: [`h2`, `spdy/3.1`, `spdy/3`, `spdy/2`, `http/1.1`, `http/1.0`]
    }
})
export class MyService {
    // ...
}
```

# Listening on both HTTPS and HTTP

When TLS is enabled, you can provide the `insecurePort` option to also listen on another port using HTTP.
In that case, Alterior will create two HTTP servers, but both will use the same bootstrapped application. 
Older WebServerEngines don't have this capability, so you may need to upgrade yours if you need this. Both
the ExpressEngine and FastifyEngine have been upgraded to support this capability as of Alterior 3.5.0.

# Server-Sent Events

You can use `WebEvent.sendEvent()` to send an event stream response back to the client. For more information about 
server-sent events, see https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events

The `data` field is serialized into JSON for you. Note that Server-Sent Events over HTTP/1.1 is not ideal as modern 
browsers only allow a maximum of six (6) connections to a given server. However, [with HTTP/2](#http2) this is not an issue.

```typescript
@Get('/sse')
async sse() {
    while (WebEvent.connected) {
        await timeout(1000);
        await WebEvent.sendEvent({ event: 'ping', data: { message: 'are you still there?' } });
    }
}
```

# Dependency Injection

Modules, controllers and services all participate in dependency injection. For more information about how DI works in Alterior apps, see the documentation for [@alterior/di](../di/README.md).

# Middleware

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

To add route-specific middleware, use the `middleware` property of the options object:

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

# Uncaught Exceptions

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

# Sessions

WARNING: Generally APIs should not use cookies. If your API is used by a by a browser application (which is the main reason you would use cookies in the first place), it is essential that you restrict the allowed origins of your API using CORS to ensure that other (potentially malicious) origins cannot request your API using credentials saved in the browser of your authorized users. Known as Cross Site Request Forgery (CSRF), this is a serious security vulnerability and it should be treated with care. 

It is far better to use the `Authorization` header to pass an explicit auth token and if necessary correlate that token to a server-managed session instead. Authorization headers are managed by the calling application, not by the user agent and are not automatically sent with requests to your API. Doing so can avoid many of the pitfalls that using cookies can cause. 

Nonetheless, if you understand the security risks and have taken the proper precautions, it is possible to use cookie-driven sessions with Alterior, though managing the session itself is not included by default.

To add session support, use `express-session`:

```
npm i express-session --save
npm i @types/express-session --save-dev
```

Include it as middleware:

```typescript
import * as session from 'express-session';
@WebService({
	middleware: [session({ secret: SESSION_SECRET })]
})
```

You can then use the session via the `Session` class which is provided for you. The simplest way to use it is via the `get()` and `set()` methods:

```typescript
@Controller()
class SampleController {
	@Get('/')
	home() {
		return Session.current.get('cartTotal');
	}
}
```

Using `get()` and `set()` provide no benefits via Typescript. The `Session` class can be subclassed however:

```typescript
class MySession extends Session {
    cartTotal : number;
}
```

You can then access that session from within your route methods like so:

```typescript
MySession.current.cartTotal
```

Note that both `Session.current` and `MySession.current` only have meaning when called from within a route method while an HTTP request is being processed. 

# OpenAPI / Swagger

Alterior can automatically generate an OpenAPI v2 schema for your defined REST endpoints. To do so, mount the included OpenApiController:

```typescript
@Mount('/openapi')
openapi: OpenApiController;
```

# Testing

Use `teststrap()` to test endpoints in your web service. Since the caller and the server are in the same process, the actual HTTP server is skipped, with requests passed directly from the `teststrap()` test to an instance of your web service.

`teststrap()` uses [supertest](https://github.com/visionmedia/supertest) as its core testing mechanism. The type of values returned by `teststrap()` is `supertest.Supertest<supertest.Test>`.

```typescript
import { teststrap } from '@alterior/web-server/dist/testing';

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

# Accessing the underlying Express application

Perhaps you need access to the Express (or other web engine) application object to do something Alterior doesn't support:

```typescript
import 
@WebService()
export class MyService {
    constructor(
    ) {
        let server = WebServer.for(this);
        this.expressApp = server.engine.app;
        this.expressApp.get('/something', (req, res) => {
            res.status(200).send('/something works!');
        });
    }
    
    private expressApp : express.Application;
}
```

You can call `WebServer.for()` and pass any web service or any controller mounted within a web service. Always pass the object instance (`this`) in order to ensure you get the correct web server instance. Note that if your controller is used in multiple web services, different instances of your controller will correspond to different instances of `WebServer`. 

# Accessing the http.Server instance

The `http.Server` instance is only available after the server has begun listening to the configured port. This happens 
after all modules receive the `OnStart` event (ie via `altOnStart`), so getting access to it during startup cannot be 
done using the usual means. For this reason the service class can receive an additional event when the web service 
has begun listening.

```typescript
    altOnListen(server : WebServer) {
        // access http.Server instance via `server.httpServer`
    }
```

If you serve over HTTPS and make use of the `insecurePort` option to also listen on HTTP, there will be two http.Server instances. You can access the insecure one using 
`insecureServer`.

# Setting the global timeout policy

Node.js http.Server has a default timeout of 2 minutes (120 seconds). You may need to increase/decrease this timeout 
depending on your use case and desired policies. You can control this from the top level Service class for your web
service:

```typescript
    altOnListen(server : WebServer) {
        server.httpServer.setTimeout(1000 * 25); // set global request timeout to 25 seconds
    }
```

# Deploying to a Cloud Function

You can deploy an Alterior web service as a Cloud Function (Google Cloud Functions, AWS Lambda, or other Function-as-a-Service (FaaS) providers) using `WebServer.bootstrapCloudFunction()`:

```typescript
// main.ts

import { MyWebService } from './my-web-service';
import { WebServer } from '@alterior/web-server';

export const cloudFunction = WebServer.bootstrapCloudFunction(MyWebService);
```

`bootstrapCloudFunction()` will handle constructing a function which takes an Express `request` and `response` and routes the given `request` through the given Alterior WebService module and populating data into `response`. This is suitable for exporting into a general cloud function environment like GCF or Lambda. 

Note: You can only pass a `@WebService()` class (ie, the top level of your web service). You cannot pass a `@Controller()` class, as controllers by themselves are not Alterior modules, and do not automatically 