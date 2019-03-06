# Alterior
[![CircleCI](https://circleci.com/gh/alterior-mvc/alterior/tree/experimental.svg?style=svg)](https://circleci.com/gh/alterior-mvc/alterior/tree/experimental)
[![Join the chat at https://gitter.im/alterior-mvc/Lobby](https://badges.gitter.im/alterior-core/Lobby.svg)](https://gitter.im/alterior-mvc/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

A framework for building Node applications in Typescript. Build all of 
your Typescript applications with this. 

Pronounced: "alt-ee-ree-or"

## Simple Example 

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

## Packages

- [@alterior/annotations](packages/annotations/README.md)
- [@alterior/common](packages/common/README.md)
- [@alterior/di](packages/di/README.md)
- [@alterior/http](packages/http/README.md)
- [@alterior/runtime](packages/runtime/README.md)
- [@alterior/web-server](packages/web-server/README.md)

## Class Libraries

Alterior strives to provide a strong isomorphic base class library that fills the gaps between 
ECMAScript and larger BCLs like Java or .NET. In service of this, Alterior ships low-level 
libraries for handling decorators/annotations, errors and error base classes, dependency 
injection, an HTTP client, and more. 

## Common 

The `@alterior/common` package provides many smaller quality-of-life utilities which can save you
time while you build your applications. 

## Annotations

The `@alterior/annotations` package provides Alterior's annotation system. 

## Dependency Injection

Alterior supports dependency injection using the same patterns as in Angular applications. The excellent `injection-js` library is used to accomplish this. Your application is constructed 
from an "entry module". That module can depend on other modules by 
adding their module classes to its `imports` list. A module can specify
a set of dependency injection providers by adding them to its `providers`
list. All providers specified by imported modules, including the module 
classes themselves, are collected into a single application-level 
injector, and then instances of all the imported module classes are instantiated using the 
dependency injector. This means module classes can participate in dependency injection just like 
regular services can.

Alterior has a number of builtin injectables which include:
 - The `Application` class. You will be given the singleton instance of your Application class as well as access to the app's `Runtime` instance.
 - `Injector` (from `injection-js`): Provides access to the dependency injector instance which created your instance.

## Custom services

To add your own injectable services, simply declare them in the `providers` list of one of the 
modules in your application.

