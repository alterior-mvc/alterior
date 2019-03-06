# @alterior/runtime

[![Version](https://img.shields.io/npm/v/@alterior/runtime.svg)](https://www.npmjs.com/package/@alterior/runtime)

Provides the core of Alterior: the ability to declare, configure, bootstrap and execute an application composed of executable modules and their dependencies.

## Installation

```
npm install @alterior/runtime
```

## Usage

An Alterior application consists of an "entry" module and its dependency imports. You "bootstrap" the entry module which causes dependencies to be resolved, an application to be constructed, and modules to be executed.

You should define your entry module in its own file (`app.module.ts`).

```typescript
@Module({
    imports: [ LoggerModule ]
})
export class AppModule {
    constructor(
        private logger : Logger
    ) {
    }

    altOnInit() {
        this.logger.info('Hello, world!');
    }
}
```

A separate entrypoint file (`main.ts`) should handle bootstrapping the entry module.

```typescript
import { bootstrap } from '@alterior/runtime';
import { AppModule } from './app.module';

bootstrap(AppModule);
```

## Module Lifecycle Events (altOnInit)

Each Alterior module is the coupling of a unit of execution (the Module class) and a set of services used by the unit and/or made available to other modules which depend on it. 

Modules can optionally define lifecycle methods which are invoked by the runtime. When a module is first bootstrapped, `altOnInit()` is run. A simple one-shot execution module should implement its business logic in `altOnInit()`.

`altOnStart()` is called when the application starts, and `altOnStop()` is called before the application is terminated, to give the module an opportunity to gracefully shut down.

## Roles

Many execution modules represent a service which can be turned on and off. Alterior has support baked in for this with Roles. Such modules can register a Role which allows the status of the service to be controlled and queried programmatically by using the `RolesService` injectable service.

To register a role, use `RolesService.registerRole(roleRegistration)`. You will need to provide `start()` and `stop()` methods which will be executed when the roles service decides to start/stop your role. You will also need to specify an `identifier` which is used when referring to the role in configuration and the environment.

When an Alterior app is bootstrapped, the `ALT_ROLES_ONLY`/`ALT_ROLES_ALL_EXCEPT` environment variables are inspected to determine which roles should be started when the application starts. The variables are comma-delimited lists of role `identifiers` that should be started or ignored. By default all registered roles are started. If both variables are specified, `ALT_ROLES_ONLY` takes precedence.