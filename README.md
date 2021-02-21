# ![Alterior](./logo.svg) [![CircleCI](https://circleci.com/gh/alterior-mvc/alterior/tree/master.svg?style=shield)](https://circleci.com/gh/alterior-mvc/alterior/tree/master) [![Join the chat at https://gitter.im/alterior-mvc/Lobby](https://badges.gitter.im/alterior-core/Lobby.svg)](https://gitter.im/alterior-mvc/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) ![License](https://img.shields.io/npm/l/@alterior/runtime.svg)

[NPM](https://www.npmjs.com/org/alterior) | [Github](https://github.com/alterior-mvc/alterior) | [Documentation](https://alterior-mvc.github.io/alterior/index.html)

A framework for building well-structured applications and isomorphic libraries in Typescript.

## Status

Alterior has three major versions.
- (**`unsupported`**) [v2.x](https://github.com/alterior-mvc/alterior/tree/2.x) is now retired.
- (**`beta`**) [v3.x](https://github.com/alterior-mvc/alterior/tree/main) is the current stable version, but it has been in a beta semver holding pattern as final details are worked out and the library is battle tested on internal projects at Astronaut Labs and elsewhere. Final production release is imminent and 3.x will be officially recommended for production use.
- (**`next`**) [v4.x](https://github.com/alterior-mvc/alterior/tree/4.x) development started in Feb 2021. 4.x APIs builds on the architecture of 3.x with small (but backwards incompatible) changes to enable [Transparent Services](https://github.com/alterior-mvc/alterior/wiki/TransparentServicesPlanning). 4.x also requires use of a custom build process handled by a new CLI tool called `alt`.

## Installation

```
npm install @alterior/runtime
```

## Building a REST Service

Alterior is **not just a REST framework**, but we'd be remiss if we didn't provide a first-class way to build REST services.

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

## General App Pattern

Alterior is not just for building REST services. Here's a minimal single file example of an application that does not use the `@WebService` syntactic sugar shown above. While it doesn't take advantage of many of the benefits of Alterior (which become more apparent as your application grows and adds richer functionality), it does succinctly convey the structural aspects, and underscores the fact that there is no unseen magic that makes Alterior apps possible:

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

## Using Alterior modules in Angular

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

## Starting a project with Alterior?

For more than demonstrative applications, the [Alterior Quickstart](https://github.com/alterior-mvc/quickstart) repository conveys an application structure 
using recommended idioms and best practices.

## Overview

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

## Packages
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

