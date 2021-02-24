# ![Alterior](./logo.svg) [![CircleCI](https://circleci.com/gh/alterior-mvc/alterior/tree/4.x.svg?style=shield)](https://circleci.com/gh/alterior-mvc/alterior/tree/4.x) [![Join the chat at https://gitter.im/alterior-mvc/Lobby](https://badges.gitter.im/alterior-core/Lobby.svg)](https://gitter.im/alterior-mvc/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) ![License](https://img.shields.io/npm/l/@alterior/runtime.svg)

[NPM](https://www.npmjs.com/org/alterior) | [Github](https://github.com/alterior-mvc/alterior) | [API reference](https://alterior-mvc.github.io/alterior/index.html?)

A framework for building well-structured applications and isomorphic libraries in Typescript.

# Status

Alterior has three major versions.
- (**`unsupported`**) [v2.x](https://github.com/alterior-mvc/alterior/tree/2.x) is now retired.
- (**`beta`**) [v3.x](https://github.com/alterior-mvc/alterior/tree/main) is the current stable version, but it has been in a beta semver holding pattern as final details are worked out and the library is battle tested on internal projects at Astronaut Labs and elsewhere. Final production release is imminent and 3.x will be officially recommended for production use.
- (**`next`**) [v4.x](https://github.com/alterior-mvc/alterior/tree/4.x) development started in Feb 2021. 4.x APIs builds on the architecture of 3.x with small (but backwards incompatible) changes to enable [Transparent Services](https://github.com/alterior-mvc/alterior/wiki/TransparentServicesPlanning). 4.x also requires use of a custom build process handled by a new CLI tool called `alt`.

# Overview

Alterior is a framework for building Typescript applications composed of 
executable modules which participate in dependency injection and declare 
components.
This is the same type of module system used by Angular (`@NgModule`) and other 
backend frameworks like Nestjs, but with a few important differences.

First, Alterior modules are _isomorphic_. This means they can be used on 
both the server (on Node.js) and in the browser (via Angular). When used with 
Angular, services provided by Alterior modules are exposed directly to 
Angular components, services, and pipes. This makes Alterior an ideal framework 
for isomorphic modules.

Second, unlike Angular/Nest.js modules, Alterior modules are well-defined 
units of execution which have a defined lifecycle, and respond to standardized 
lifecycle events. This makes them suitable for use as a primary vehicle for 
top-level general purpose code, such as a server or even a desktop 
application. 

## Class Libraries

Alterior strives to provide a strong isomorphic base class library that fills 
the gaps between ECMAScript and larger BCLs like Java or .NET. In service of 
this, Alterior ships low-level libraries for handling decorators/annotations, 
errors and error base classes, dependency injection, an HTTP client, and more. 

# Getting Started

Alterior is **not just a REST framework**, but that's certainly it's most common usage.

```typescript
import '@alterior/platform-nodejs';
import { WebService, Get } from '@alterior/web-server';
import { Application } from '@alterior/runtime';

@WebService()
export class MyWebService {
    @Get('/service-info')
    info() {
      return { 
        service: 'my-web-service' 
      };
    }
}

Application.bootstrap(MyWebService);
```

For more information on building web services with Alterior, see [@alterior/web-server](packages/web-server/README.md).

## Consuming your web service

A web service built with Alterior 4 can be consumed on the client transparently. This is an example of a [Transparent Service](https://github.com/alterior-mvc/alterior/wiki/TransparentServicesPlanning)

```typescript
import { MyWebService } from '@example/my-backend';
import { Component } from '@angular/core';

@Component({ selector: 'my-component', ... })
export class MyComponent {
  constructor(
    private service : MyWebService
  ) {
  }

  onButtonClicked() {
    let serviceInfo = await this.service.info();
    console.log(serviceInfo);
    // { service: 'my-web-service' }
  }
}
```

Transparent services are not limited to being used in Angular. The simplest way to consume a service on the frontend is to create it using Service.bootstrap()

```typescript
import { Service } from '@alterior/runtime';
import { MyWebService } from '@example/my-backend';

let service = Service.bootstrap(MyWebService);
```

## Creating a project

Start by installing the Alterior command line tooling:

```
npm install @alterior/cli -g
```

Then you can generate a new Alterior service:

```
alt new service my-web-service
```

A new folder called `my-web-service` will be created containing a fully formed Alterior project. To start the service, enter the new folder and call

```
npm start
```

To publish the project to NPM for use in your frontend, use

```
npm publish
```

Alterior automatically handles everything needed to build and publish your application, including removing your actual backend code if you have asked for that.

# Mechanics

Alterior is not just for building REST services. Here's a minimal single file example of an application that is something other than a `@WebService`.

```typescript
import 'reflect-metadata';
import { Module, OnInit, AppOptions, Application } from '@alterior/runtime';

@Module()
export class AppModule implements OnInit {
    public altOnInit() {
        console.log('Hello world!');
    }
}

Application.bootstrap(AppModule);
```

This becomes useful because Alterior modules can participate in dependency injection and builtin lifecycle management functionality. A class decorated with `@WebService()` is also considered an `@Module()`.

### Dependency Injection

Bootstrapped classes can participate in dependency injection. 

```typescript
import 'reflect-metadata';
import { Module, OnInit, AppOptions, Application } from '@alterior/runtime';
import { Injectable } from '@alterior/di';

@Injectable()
export class WorldService {
  theWorld() {
    return 'world';
  }
}

@Injectable()
export class HelloService {
  constructor(
    private world : WorldService
  ) {
  }

  sayHello() {
    return `hello, ${this.world.theWorld()}`;
  }
}

@Module()
export class AppModule implements OnInit {
    constructor(
      private hello : HelloService
    ) {
    }

    public altOnInit() {
        console.log(this.hello.sayHello());
    }
}

Application.bootstrap(AppModule);
```

### Lifecycle Management

Modules can have any of the following lifecycle methods which act as hooks for running custom behaviors

- **`altOnInit()`** Called when the module is bootstrapped. Implement the `OnInit` interface when using this lifecycle method. 
- **`altOnStart()`** Called when the overall application is started. Implement the `OnStart` interface when using this lifecycle method.
- **`altOnStop()`** Called when the overall application is stopped before exiting. Implement the `OnStop` interface when using this lifecycle method.
- **`RolesService`** The notion of "roles" is used to allow a module to define or react to a certain class of functionality being started or stopped. For instance `@/web-server` adds a `web-server` role which can be enabled or disabled at configuration time to control whether the web server portion of the application is enabled or disabled. Similarly `@/tasks` adds a `task-worker` role. By default all roles 
are started when the application starts. This can be used to start only a specific portion of an application in a particular environment, for instance having the web server and task worker roles started in development, but splitting these into separate tiers in production.

For more information about lifecycle management, see [the Roles section of the @/runtime documentation](packages/runtime/README.md#roles).

# Packages
Alterior consists of the following individual NPM packages. You can pull in 
packages as you need them.

- **[@alterior/annotations](packages/annotations/README.md)**  
  A system for decorating and introspecting standardized metadata on programmatic elements in Typescript  
  [![Version](https://img.shields.io/npm/v/@alterior/annotations.svg)](https://www.npmjs.com/package/@alterior/annotations)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/annotations.svg)
  
- **[@alterior/common](packages/common/README.md)**  
  Provides many smaller quality-of-life utilities which can save you
time while you build your applications.  
  [![Version](https://img.shields.io/npm/v/@alterior/common.svg)](https://www.npmjs.com/package/@alterior/common)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/common.svg)

- **[@alterior/di](packages/di/README.md)**  
  Provides a flexible Angular-style dependency injection framework based on `injection-js`  
  [![Version](https://img.shields.io/npm/v/@alterior/di.svg)](https://www.npmjs.com/package/@alterior/di)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/di.svg)

- **[@alterior/http](packages/http/README.md)**  
  HTTP client library as an Alterior module (ported from `@angular/http`)  
  [![Version](https://img.shields.io/npm/v/@alterior/http.svg)](https://www.npmjs.com/package/@alterior/http)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/http.svg)
  
- **[@alterior/logging](packages/logging/README.md)**  
  A logging library which supports pluggable listeners and context-tracked logging using `Zone.js`  
  [![Version](https://img.shields.io/npm/v/@alterior/logging.svg)](https://www.npmjs.com/package/@alterior/logging)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/logging.svg)

- **[@alterior/platform-angular](packages/platform-angular/README.md)**
  Provides support for loading Alterior modules into an Angular app, including 
  the ability to access Alterior injectable services from Angular components 
  and services. Use this to consume isomorphic libraries from within frontend 
  apps written in Angular.
  [![Version](https://img.shields.io/npm/v/@alterior/platform-angular.svg)](https://www.npmjs.com/package/@alterior/platform-angular)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/platform-angular.svg)

- **[@alterior/platform-nodejs](packages/platform-nodejs/README.md)**
  Provides support for bootstrapping an Alterior application within the 
  Node.js server environment.
  [![Version](https://img.shields.io/npm/v/@alterior/platform-nodejs.svg)](https://www.npmjs.com/package/@alterior/platform-nodejs)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/platform-nodejs.svg)

- **[@alterior/runtime](packages/runtime/README.md)**  
  An module-based dependency injection and lifecycle event system similar to 
  that of Angular, suitable for use in Alterior libraries and applications.
  [![Version](https://img.shields.io/npm/v/@alterior/runtime.svg)](https://www.npmjs.com/package/@alterior/runtime)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/runtime.svg)

- **[@alterior/tasks](packages/tasks/README.md)**  
  A system for enqueuing and processing tasks using Redis as it's backing store (based on `bull` queue)  
  [![Version](https://img.shields.io/npm/v/@alterior/tasks.svg)](https://www.npmjs.com/package/@alterior/tasks)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/tasks.svg)

- **[@alterior/web-server](packages/web-server/README.md)**  
  A system for building RESTful web services declaratively using classes & decorators  
  [![Version](https://img.shields.io/npm/v/@alterior/web-server.svg)](https://www.npmjs.com/package/@alterior/web-server)
  ![Size](https://img.shields.io/bundlephobia/min/@alterior/web-server.svg)

## Compatibility

### Using Alterior modules in Angular

You can use any browser-compatible Alterior module in Angular by using  
`@alterior/platform-angular`:

```typescript
import { AngularPlatform } from '@alterior/angular-platform';
import { MyAlteriorModule, MyAlteriorService } from '@my/alterior-module';

@NgModule({
  providers: [
    AngularPlatform.bridge(
      MyAlteriorModule,
      // ...
    )
  ]
})
export class AppModule {
  constructor(
    someAlteriorService : MyAlteriorService
  ) {
    console.log(`The following service was injected from an Alterior module:`);
    console.log(someAlteriorService);
  }
}
```

For more about using Alterior modules in Angular, see [@alterior/platform-angular](packages/platform-angular/README.md).
