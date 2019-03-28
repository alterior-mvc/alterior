# Alterior
[![CircleCI](https://circleci.com/gh/alterior-mvc/alterior/tree/experimental.svg?style=shield)](https://circleci.com/gh/alterior-mvc/alterior/tree/experimental)
[![Join the chat at https://gitter.im/alterior-mvc/Lobby](https://badges.gitter.im/alterior-core/Lobby.svg)](https://gitter.im/alterior-mvc/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
![License](https://img.shields.io/npm/l/@alterior/runtime.svg)


A framework for building Node applications in Typescript. Build 
your Typescript applications with this. 

## Usage

```
npm install @alterior/runtime
```

Here's a minimal single file example:

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

## Starting a project with Alterior?

For more than demonstrative applications, we have recommended idioms and 
best practices that can be seen in our Quickstart repository.

See [Alterior Quickstart](https://github.com/alterior-mvc/quickstart)

## Overview

At it's heart, Alterior is a framework for building Typescript applications composed of executable modules which participate in dependency injection and declare components.
This is the same type of module system used by Angular (`@NgModule`) and other backend frameworks like Nestjs, but with a few important differences.

First, Alterior modules can be used for both server-side and client-side code. Every Alterior 
module can be used as an Angular module, and vice versa. This offers interesting possibilities
for isomorphic applications.

Second, unlike Angular modules, Alterior modules are _units of execution_, with a defined lifecycle, which respond to standardized lifecycle events. This makes them suitable for 
use as a primary vehicle for top-level general purpose code. 

## Class Libraries

Alterior strives to provide a strong isomorphic base class library that fills the gaps between 
ECMAScript and larger BCLs like Java or .NET. In service of this, Alterior ships low-level 
libraries for handling decorators/annotations, errors and error base classes, dependency 
injection, an HTTP client, and more. 

## Packages
Alterior consists of the following individual NPM packages. You can pull in packages as you need them.

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

- **[@alterior/runtime](packages/runtime/README.md)**  
  An Angular-compatible module system suitable for use in Typescript-on-Node.js applications  
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

