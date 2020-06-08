# @alterior/platform-angular

[![Version](https://img.shields.io/npm/v/@alterior/platform-angular.svg)](https://www.npmjs.com/package/@alterior/platform-angular)

Provides support for loading Alterior modules into an Angular app, including 
the ability to access Alterior injectable services from Angular components 
and services. Use this to consume isomorphic libraries from within frontend 
apps written in Angular.

# Rationale

In Angular 9, loading Alterior modules natively is not yet supported. This is
due to the new Ivy compiler. We hope to add support for this in the future, but
in the mean time you can use `@alterior/platform-angular` to use Alterior modules
within your Angular 9+ apps. Instead of adding Alterior modules directly to 
the `imports` property of `@NgModule()`, you should instead use:

```typescript
import { AngularPlatform } from '@alterior/platform-angular';

@NgModule({
    providers: [
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

This will bootstrap the Alterior app and provide its injectable dependencies 
via Angular. Because the Alterior app is actually booted, all lifecycle events 
work as they do normally. AngularBridge also makes available Alterior's 
base services, so you can start all loaded Alterior services like so:

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

In Angular 8 and earlier Alterior modules can be added directly