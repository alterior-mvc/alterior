# @alterior/di

[![Version](https://img.shields.io/npm/v/@alterior/di.svg)](https://www.npmjs.com/package/@alterior/di)

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