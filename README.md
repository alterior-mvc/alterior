# alterior-core

[![Join the chat at https://gitter.im/alterior-core/Lobby](https://badges.gitter.im/alterior-core/Lobby.svg)](https://gitter.im/alterior-core/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
An Express-based Typescript MVC framework using decorators and Angular 2 dependency injection. 

## Getting started

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
        // TODO: Perform "health" checks like connecting to database, etc
    	  return Promise.resolve(true);
    }
    
    public altOnInit() {
        console.log('Service is started!');
    }
}
```

Create a controller (let's say `foo.ts`):

```typescript
import { Controller, Get } from '@alterior/core';
import * as express from 'express';

@Controller()
export class FooController {
    @Get('/foo')
    public foo(req : express.Request, res : express.Response)
    {
        res.status(200).send("/foo works!");
    }
}
```

Import your controller at the top of `app.ts`:

```typescript
import "foo";
```

Finally, you must bootstrap your application. Typically this is done in a `main.ts` entrypoint file:

```typescript
import { Application } from './app';
import { bootstrap } from '@alterior/core';

bootstrap(Application);
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

## MongoDB integration

As a proof-of-concept, MongoDB support is currently built into `@alterior/core`. Alterior is in pre-release, in the near future this functionality will be moved to a separate module. 
First, you must declare how you want MongoDB to connect using the `@AppOptions` decorator.

In your application class file (`app.ts`):
```typescript
import { mongoProvider } from '@alterior/core';
import * as mongodb from 'mongodb';

@AppOptions({
    providers: [mongoProvider(mongodb.Db, "mongodb://localhost:27017/db")]
})
class Application {
    // ...
}
```

The `mongoProvider()` function takes a token to make available via DI (most single-connection apps should use `mongodb.Db` but any value or object/function reference can be used which is useful for having multiple Mongo DB connections) and it takes the URL to the mongodb server.
Now you can inject `mongodb.Db` (or whatever token you chose) anywhere in your application:

```typescript
import * as mongodb from 'mongodb';
import { Controller, Get } from '@alterior/core';
import * as express from 'express';

@Controller()
class FooController {
    constructor(
        private db : mongodb.Db
    ) {
    }
    
    @Get("/foo")
    public foo(req : express.Request, res : express.Response) {
        this.db.collection("foos").findOne({ color: blue })
            .then(item => res.status(200).send(JSON.stringify(item)))
            .catch(e => res.status(500).send("An error occurred"));
    }
}
```
