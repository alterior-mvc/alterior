# @alterior/platform-angular

[![Version](https://img.shields.io/npm/v/@alterior/platform-angular.svg)](https://www.npmjs.com/package/@alterior/platform-angular)

Provides support for loading Alterior modules into an Angular app, including 
the ability to access Alterior injectable services from Angular components 
and services. Use this to consume isomorphic libraries from within frontend 
apps written in Angular.

# Installation

```
npm install @alterior/platform-angular
```

# Usage

In Angular 7.0 and later, static analysis is used to determine the structure 
and metadata of your application. This means Angular no longer requires you to 
load the `reflect-metadata` polyfill. Alterior's reflection system _does_ use 
it, so you must ensure your app loads it. In earlier versions you can skip this 
step.

To enable this add the following in `polyfills.ts`:

```typescript
import 'reflect-metadata';
```

Alterior modules cannot be directly used as Angular modules.
- Alterior has its own lifecycle hooks that Angular does not understand
- Alterior provides built-in services (like `Application`, `Runtime`, etc) that Angular does not provide
- Angular's module system is not built in a way that allows for direct compatibility with other frameworks (something we'd love to work with them on) 

Instead, `@alterior/platform-angular` provides a way to bootstrap one or more Alterior modules and export the resulting dependency injection providers in a format that Angular can understand. 

```typescript
import { AngularPlatform } from '@alterior/platform-angular';

@NgModule({
    providers: [ // <-- *not* imports
        AngularPlatform.bridge(
            MyAlteriorModule1,
            MyAlteriorModule2,
            // ...
        )
    ]
})
export class AppModule {
}
```

This will bootstrap a dynamic Alterior app module which `imports` the given modules and passes back its injectable dependencies so that your Angular module can register them. 

Because Alterior is bootstrapped just like it is on the server-side, all 
defined lifecycle events work as they do normally.

`AngularPlatform.bridge()` also provides all of Alterior's base services to 
your Angular app, so you can, for instance, start (`altOnStart()`) all the Alterior modules you've loaded:

```typescript
import { Component, OnInit } from '@angular/core';
import * as AltRuntime from '@alterior/runtime';

@Component(/* ... */)
export class AppComponent extends OnInit {
    constructor(
        private altApp : AltRuntime.Application
    ) {

    }

    ngOnInit() {
        this.altApp.start();
    }

    // you can also stop the Alterior app:
    // - presumably connected to some button in the template
    onStopButtonClicked() {
        this.altApp.stop();
    }
}
```
