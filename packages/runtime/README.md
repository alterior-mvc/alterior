# @alterior/runtime

[![Version](https://img.shields.io/npm/v/@alterior/runtime.svg)](https://www.npmjs.com/package/@alterior/runtime)

Provides the core of Alterior: the ability to declare, configure, bootstrap and execute an application composed of executable modules and their dependencies.

# Installation

```
npm install @alterior/runtime
```

# Usage

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

# Architecture 

An Alterior **application** consists of one or more **modules** which represent separate logical pieces of an application.

Each Alterior **module** is the coupling of a unit of execution (the Module class) and a set of dependency injection service classes which are used by the module and/or made available to other modules which may depend on it. 

Modules may respond to [lifecycle events](#LifecycleManagement) which are invoked by the runtime as application execution progresses. For example, when the application is being bootstrapped the `onInit` lifecycle event is emitted. A simple one-shot execution module may choose to implement its business logic by reacting to this event. Once all modules complete their handling of `onInit`, the `afterInit` event is emitted.

As soon as all modules of an application are initialized, the application has been bootstrapped and is ready to be used. By default Alterior will proceed to start the application. The `onStart` lifecycle event will be emitted, allowing modules to perform any required startup procedures. Once all modules complete their handling of `onStart`, the `afterStart` event is emitted.

The application will continue to run until it is stopped programmatically or by the user. When 
that occurs, the `onStop` lifecycle event is emitted to give modules an opportunity to gracefully shut down. Once all modules complete their handling of `onStop`, the `afterStop` event is emitted. After that, the application is terminated.

Modules cannot be configured to start and stop based on a configuration, but Alterior provides for such functionality using the [Application Roles](#ApplicationRoles) system. 

# Lifecycle Management

Lifecycle events provide a convenient way to add custom behavior to your application. There are a number of 
ways to subscribe to a lifecycle event depending on what's needed. 

The first (and recommended) path is to use the lifecycle event symbols provided by the class decorator related to the 
type of class you are writing. For instance, when creating an Alterior module using `@Module()`, you can subscribe to 
the standard `onInit` event by naming your method using the `Module.onInit` symbol.

```typescript
import { Module } from '@alterior/runtime';

@Module()
class MyModule {
  [Module.onInit]() {
    console.log(`My module has initialized!`);
  }
}
```

Alterior's runtime lifecycle events are used for more than just Modules. Other kinds of classes also support lifecycle
events as well as the convention of accessing their names from a host decorator, such as `@WebService()` from 
`@/web-service` and `@Task()` from `@/tasks`.

You might wish to use a different method name, or to have a single method called for multiple lifecycle events. To do 
this you can use the provided convenience decorators.

```typescript
import { Module, OnInit, OnStop } from '@alterior/runtime';

@Module()
class MyModule {
  @OnInit() @OnStop()
  myMethod() {
    console.log(`This runs when the app is initialized and when the app is stopped.`);
  }
}
```

The `@OnInit()` and `@OnStop()` decorators are convenience forms for `@LifecycleEvent(eventName: symbol)`. The 
`eventName` parameter can specify any of the built-in lifecycle event types, or a custom event type provided by a library
or your own application. Alterior's built-in lifecycle event name symbols are provided as constants such as `ALT_ON_INIT` and are grouped together for convenience in the constant `BuiltinLifecycleEvents` exported object, so the last example is identical to the folowing:

```typescript
import { Module, LifecycleEvent, BuiltinLifecycleEvents } from '@alterior/runtime';

@Module()
class MyModule {
  @LifecycleEvent(BuiltinLifecycleEvents.onInit)
  @LifecycleEvent(BuiltinLifecycleEvents.onStop)
  myMethod() {
    console.log(`This runs when the app is initialized and when the app is stopped.`);
  }
}
```

## Built-in Lifecycle Events

The following built-in lifecycle events are available. The short name is used when accessing the lifecycle event name via one of Alterior's standard class decorators or via the `BuiltinLifecycleEvents` object, so for instance the short name `onInit` can be accessed as `Module.onInit()` or `BuiltinLifecycleEvents.onInit()`.

| Short name | Decorator | Constant | Symbol Identity | Description |
|------------|-----------|----------|-----------------|-------------|
| `onInit`   | `@OnInit()` | `ALT_ON_INIT` | `@alterior/runtime:onInit` | Called when the application is being bootstrapped |
| `afterInit`   | `@AfterInit()` | `ALT_AFTER_INIT` | `@alterior/runtime:afterInit` | Called after all modules in the application have been initialized |
| `onStart`  | `@OnStart()` | `ALT_ON_START` | `@alterior/runtime:onStart` | Called when the application is being started, either automatically (when the `autostart` option is true) or by calling `Application#start()`. |
| `afterStart`  | `@AfterStart()` | `ALT_AFTER_START` | `@alterior/runtime:afterStart` | Called after all `onStart` lifecycle methods have completed executing. |
| `onStop`   | `@OnStop()` | `ALT_ON_STOP` | `@alterior/runtime:onStop` | Called when the application is being stopped via `Application#stop()` |
| `afterStop`   | `@AfterStop()` | `ALT_AFTER_STOP` | `@alterior/runtime:afterStop` | Called after all `onStop` lifecycle methods have completed executing. |

There are some additional lifecycle methods that are only available in certain contexts such as the `@OnListen()` event provided by `@/web-server`. Please consult the documentation for individual modules to learn about additional lifecycle events.

- **`ApplicationRoles`** The notion of "roles" is used to allow a module to define or react to a certain class of functionality being started or stopped. For instance `@/web-server` adds a `web-server` role which can be enabled or disabled at configuration time to control whether the web server portion of the application is enabled or disabled. Similarly `@/tasks` adds a `task-worker` role. By default all roles 
are started when the application starts. This can be used to start only a specific portion of an application in a particular environment, for instance having the web server and task worker roles started in development, but splitting these into separate tiers in production.

You can create your own lifecycle events and emit them whenever you'd like.

# Application Roles

Many execution modules represent a service which can be turned on and off. Alterior has support baked in for this with Roles. Such modules can register a Role which allows the status of the service to be controlled and queried programmatically by using the `RolesService` injectable service.

To register a role, use `RolesService.registerRole(roleRegistration)`. This is usually done within the `altOnInit()` method of a class marked with `@Module()`. You will need to provide `start()` and `stop()` methods which will be executed when the roles service decides to start/stop your role. You will also need to specify an `identifier` which is used when referring to the role in configuration and the environment.

# Configuring enabled roles

When an Alterior app is bootstrapped, several environment variables are inspected to determine which roles should be 
enabled by default. They are checked in the following order (the first one found wins).

- `ALT_ROLES_ONLY` - Enable only the given roles
- `ALT_ROLES_ALL_EXCEPT` - Enable all roles except those listed (including roles that are disabled by default)
- `ALT_ROLES_DEFAULT_EXCEPT` - Enable all default-enabled roles except those listed

The variables are comma-delimited lists of role `identifiers` that should be started or ignored. By default all 
registered roles which are configured as enabled by default are started. 

Alternatively you can specify roles via the command line when the application is started using one of the following 
options:

```
--roles-only,       -r  [role,...]  Enable only the specified roles
--roles-skip,       -x  [role,...]  Enable all default-enabled roles except those specified
--all-roles-except, -R  [role,...]  Enable all roles except the specified roles (regardless of default status)
```

For example, to enable only the `web-server` and `tasks` roles:

```
node dist/main.js -r web-server,tasks
```

# Stopping the application

The application can be explicitly stopped by injecting `Runtime` and calling the `shutdown()` method. This causes the `altOnStop()` lifecycle event to be run for all loaded modules, and execution to be stopped with `process.exit()`. If you wish to stop all modules of the application without exiting the process, use `Runtime.stop()` instead. 

# Custom Lifecycle Events

You can programmatically trigger custom lifecycle events by calling `Runtime.fireEvent(eventName)`. 

`eventName` should be an UpperCamelCase string. The method executed on modules will be `alt${eventName}`, so if you specify `DoSomething`, then the method `altDoSomething()` will be executed on each module which implements it.

# Self Test

Passing `--self-test` to your application will cause Alterior to stop after the application is bootstrapped and perform a successful exit.
This can be used as a sanity check to make sure that your service starts correctly while building.