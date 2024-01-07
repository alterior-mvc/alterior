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
import { Application } from '@alterior/runtime';
import { AppModule } from './app.module';

Application.bootstrap(AppModule);
```

## Module Lifecycle Events

Each Alterior module is the coupling of a unit of execution (the Module class) and a set of services used by the unit and/or made available to other modules which depend on it. 

Modules can optionally define lifecycle methods which are invoked by the runtime. When a module is first bootstrapped, `altOnInit()` is run. A simple one-shot execution module should implement its business logic in `altOnInit()`.

`altOnStart()` is called once when the application starts, and `altOnStop()` is called before the application is terminated, so as to give the module an opportunity to gracefully shut down. If you want the ability to dynamically control the start/stop status of your module, you should use Roles.

## Roles

Many execution modules represent a service which can be turned on and off. Alterior has support baked in for this with Roles. Such modules can register a Role which allows the status of the service to be controlled and queried programmatically by using the `RolesService` injectable service.

To register a role, use `RolesService.registerRole(roleRegistration)`. This is usually done within the `altOnInit()` method of a class marked with `@Module()`. You will need to provide `start()` and `stop()` methods which will be executed when the roles service decides to start/stop your role. You will also need to specify an `identifier` which is used when referring to the role in configuration and the environment.

## Configuring enabled roles

When an Alterior app is bootstrapped, the `ALT_ROLES_ONLY`/`ALT_ROLES_ALL_EXCEPT` environment variables are inspected to determine which roles should be started when the application starts. The variables are comma-delimited lists of role `identifiers` that should be started or ignored. By default all registered roles are started. If both variables are specified, `ALT_ROLES_ONLY` takes precedence.

Alternatively you can specify roles via the command line when the application is started using one of the following options:

```
--roles-only,   -r [role,...]  Enable only the specified roles
--roles-except, -R [role,...]  Enable all roles except the specified roles
```

For example, to enable only the `web-server` and `tasks` roles:

```
node dist/main.js -r web-server,tasks
```

## Stopping the application

The application can be explicitly stopped by injecting `Runtime` and calling the `shutdown()` method. This causes the `altOnStop()` lifecycle event to be run for all loaded modules, and execution to be stopped with `process.exit()`. If you wish to stop all modules of the application without exiting the process, use `Runtime.stop()` instead. 

## Custom Lifecycle Events

You can programmatically trigger custom lifecycle events by calling `Runtime.fireEvent(eventName)`. 

`eventName` should be an UpperCamelCase string. The method executed on modules will be `alt${eventName}`, so if you specify `DoSomething`, then the method `altDoSomething()` will be executed on each module which implements it.

## Self Test

Passing `--self-test` to your application will cause Alterior to stop after the application is bootstrapped and perform a successful exit.
This can be used as a sanity check to make sure that your service starts correctly while building.