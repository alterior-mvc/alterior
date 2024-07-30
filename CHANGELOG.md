# ⏭ vNext
- `@/web-server`
    * Added the WebEventZone to the default request logging context to allow custom console logger implementations to access the current 
      WebEvent instance.

# v3.12.0
- `@/web-server`
   * It is now possible to subclass `HttpError` and have Alterior handle it as expected. This was not possible prior due to 
     issues long since solved with how extended Error works (when Alterior targeted ES5, this was not possible in Typescript 2.1 or 
     later). Since this is no longer an issue, this restriction has been lifted.

# v3.11.2
- `@/web-server`
   * [(!!) Potential security issue / denial of service] Fixed a crash when the server receives invalid JSON during body parsing or other 
     errors raised by Connect middleware. **Please update to this patch or higher**. Issue existed between v3.8.0 and v3.11.1.
     Fix has been backported to affected series with the following patch releases:
     * Backported as v3.10.3
     * Backported as v3.9.5
     * Backported as v3.8.1
   * Add `middleware` request reporting event (currently unused by the default request reporter)
   
# v3.11.1
- `@/web-server`
   * Adds `globalMiddleware` option to `@Controller()`. This has the same semantics as `middleware` in previous releases,
     but with clarified naming.
   * The `middleware` option of `@Controller()` is now deprecated in favor of `globalMiddleware`.
   * Fixes a problem where JSON strings cannot be used with the new `@Body({ type: 'json' })` feature because of 
     `body-parser`'s "strict mode". Disabled "strict mode" when using the JSON mode of the `body-parser` middleware 
     internally.

# v3.11.0
- `@/annotations`
    * Improves the return type of `Annotation.decorator()` so that it is dependent on the provided `valueTargets` (when
      possible). [Issue](https://github.com/alterior-mvc/alterior/issues/102)
- `@/web-server`
    * Adds ability to override the body parser in use via the `@Body()` decorator. This is useful for cases like trying 
      to accept JSON strings (since `string` normally causes a `text` body parser to be used).

# v3.10.2
- `@/web-server`
    * Fixes an issue where a request's body will be unparsed if the `Content-Type` passed does not match the typical 
      content type associated with the expected body format. For instance, when expecting JSON (the default), the body
      would only be parsed when the `Content-Type` header was `application/json`. When expecting text  (ie when `@Body()`
      has type `string`), the body would only be parsed when the `Content-Type` header was `text/plain`. This is unexpected,
      since Alterior provides no manner to validate the `Content-Type` field without using custom middleware. Now the body
      is parsed as the expected type regardless of `Content-Type`.

# v3.10.1
- `@/web-server`
    * Fixes an issue where `route` is not present on `WebEvent`

# v3.10.0
- `@/di`
    * You can now use `Injector.run()` to run a callback within an injection context for the given injector.

# v3.9.4
- `@/web-server`
    * Fixes a bug where failing to provide a body when using the `Response` class would cause an exception
      within Express. Failing to provide a body now ends the response without outputting a body.
    * Corrects the type of `ConnectMiddleware` to require the `next()` function to be passed. 
      This fixes type errors when using many Connect middlewares.

# v3.9.3

- `@/express`
    * `ExpressEvent` now properly exposes `current` as an Express-specific `WebEvent`, 
      `request` as `express.Request` and `response` as `express.Response` as intended.
      Previously this class returned the same values as `WebEvent` which was not useful.

# v3.9.2

- `@/web-server`
    * Fixed an issue where `Session.current().foo = 123` would not set the session variable as expected.

# v3.9.1
- `@/web-server`
    * The `Session` class is now exported properly.

# v3.9.0

- `@/web-server`
    * Adds support for "interceptors". Interceptors let you wrap the execution of all controller methods in
      the web service. They can be defined in the optionss for `@WebService()`, `@Controller` or the `@Route()` family
      of decorators. They are similar to applying a mutator, but without needing to use decorators, and without needing 
      to declare the interception on every controller method. Use `WebEvent.current` to access details about the request.
    * Adds `@Intercept()` decorator as a convenient way to apply a function conforming to the `Interceptor` type directly
      to a method definition. 
    * `WebEvent.inject()` is a convenience function for `WebEvent.current.get()`
    * `webEvent.inject()` is a convenience function for `webEvent.server.injector.get()`

# v3.8.0

- `@/web-server`
    * Route-specific middleware can now use `WebEvent.current` to acquire the web event being processed. While middleware
      has always had access to the request/response pair, the current WebEvent also provides access to the controller and 
      method which is about to be executed, amongst other things. This enables middleware to introspect the method call 
      that is about to occur, enabling a broad set of use cases that were previously impossible. NOTE: Global and 
      controller-level middleware cannot access `WebEvent.current` as they occur before any Alterior-specific 
      processing occurs.
    * Alterior-style middleware classes are now resolved *per request*, allowing dependency injection providers to 
      differ per call. This has been used to allow `WebEvent` to be dependency injected as an alternative way of 
      acquiring it.
    * The new `preRouteMiddleware` and `postRouteMiddleware` options allow you to specify route-specific middleware at 
      the global and controller levels, enabling you to use the new introspection capabilities without specifying 
      middleware on every route. The order of application is: (1) global pre-middleware, (2) controller pre-middleware,
      (3) route-specific middleware, (4) controller post-middleware, (5) global post-middleware.
    * It is no longer necessary to mark middleware classes with `@Middleware()`. All classes are now treated as 
      Alterior-style middleware (dependency injected, implements a `handle()` method). This is not a breaking change 
      since passing a class not marked with `@Middleware()` would have caused a runtime error prior. As a result of 
      this `@Middleware()` has been deprecated, and will be removed in 4.0.0.
    * Correctness change: The type safety of the middleware-related properties of `WebServerOptions`, `@Controller()` and 
      the `@Route()` family of decorators has been strengthened.
- `@/common`: Adds `leftPad()`, `rightPad()`, `zeroPad()` and `isConstructor()`

# v3.7.6

- `@/web-server`: [(!!) Potential security issue] Fixes an issue which causes the optional secondary HTTP listener to 
  be enabled even when not configured. This would cause Alterior web services to listen on a random high TCP port in 
  addition to the primary port you configure. This may be security impacting for some deployment / firewall 
  configurations.

# v3.7.5

- `@/web-server`: 
    - Added the ability to override the default web server engine on specific `@WebService` classes
    - Fixes an issue where installing Express' Typescript types alongside `@/web-server` may have been needed even 
      though `@/web-server` does not have a direct dependency on Express
- `@/common`: `getParameterNames()` will now look for a `__parameterNames` property and use that before trying to 
  introspect the function, which allows code that transforms/replaces functions to carry parameter name metadata 
  across more easily.
- `@/annotations`: 
    - When running a mutator against a function, preserve parameter names by setting a `__parameterNames`
      property on the resulting function, containing the parameter names of the original function.
    - Type safety has been improved around `Mutator.create()` and `Mutator.define()`

# v3.7.4
- `@/runtime`: Add `parentInjector` bootstrap option to allow for more complex application bootstrapping.

# v3.7.3
- `@/platform-angular`: Increase the Angular versions allowed by peer dependency

# v3.7.2 
- `@/di`: Remove unused `zone.js` peer dependency

# v3.7.1
- `@/web-server`: Remove direct type references to `express`
- `@/di`: Fix type of `Injector#parent` when using `strictNullChecks`
- `@/runtime`: Add missing object type constraint on `Reflector#getTypeFromClass`

# v3.7.0
- `@/runtime`
  * A new lifecycle event `altAfterStart` can be used to run code after all modules' `altOnStart` callbacks have 
    completed and all effective roles have been started (see `RolesService`).

# v3.6.7
- `@/runtime`
  * `RoleRegistration#instance` is now optional. When not specified, the only way to target a role is by its identifier.
 
# v3.6.6
- `@/common`
  * Alterior's standard error classes now extend from `Error`
  * The inaccessible `innerError` property has been removed. Use the ES standard `cause` instead.

# v3.6.5
- `@/runtime`
  * Fixed an issue where using role identifiers within environment/command-line configuration could 
    cause the wrong role to be enabled if multiple roles are defined within a single module.
  * An error is now thrown if a role specified in the effective roles configuration does not exist.
  * `RolesService#configure()` now accepts string identifiers of roles in addition to class references.
  * `RolesService#getForModule()` now throws if there are multiple roles defined for the given module.

# v3.6.3
- `@/platform-nodejs`
  * Upgrades Zone.js to 0.14.3
  * Loads the Node.js specific Zone.js bundle
  * Loads the RxJS zone patch
  * Loads reflect-metadata and source-map-support before initializing `dotenv`.
- `@/web-server`
  * To help avoid accidentally using ES2017 or later (which is not supported by Alterior 
    or any other libraries which use Zone.js), an error will now be thrown if a native async function is used as a route method.

# v3.6.2
- `@/runtime`: Fixes an issue where the short form of the new `--roles-skip` command line option (`-x`) was 
  ignored.

# v3.6.1
- `@/runtime`: Add `enabledByDefault` to `RoleRegistration` and default to all services which are enabled by default.
  Allows for some roles to be disabled unless specifically asked for. Roles which are disabled by default are still 
  included in `all-except` configuration. Use the new `default-except` (or via `ALT_ROLES_DEFAULT_EXCEPT` environment
  variable) to enable all default services except those listed. Additionally there is now an `--roles-skip` option 
  which enables the `default-except` mode.
 
# v3.6.0
- `@/runtime`: Allow specifying additional providers when bootstrapping an application
- `@/platform-nodejs`
    - `dotenv` version 16.3.1
        - **Please note these changes**
            * Comments are now supported
            * Multiline strings are now supported
            * Backtick quotes are now supported
    - `ws` version 8.16.0
    - `source-map-support` version 0.5.21
- `@/logging`: 
    * Added missing `fatal()` convenience function
    * Added static shortcuts to `Logger` (ie `Logger.info()` means `Logger.current.info()`)
# v3.5.8
- `@/web-server`:
  - Fixes a bug where TLS options are not properly initialized in some cases, causing a crash.
  - Fixes a bug where automatically generated self-signed certificates (when requesting HTTP/2 or SPDY without specifying
    a certificate) are not used, causing the server to boot into HTTP only mode instead of HTTPS.

# v3.5.7
- `@/web-server`:
  - Fixes more semantic issues with certificate generator on Forge

# v3.5.6
- Re-release of packages to resolve package resolution issues

# v3.5.5
- `@/web-server`: Fix a semantic issue with the Forge library in certificate generation 

# v3.5.4
- Sources are now included with packages to enable easier sourcemap debugging of the Alterior packages.

# v3.5.3
- `@/di`: Better type safety for TypeProvider (must be concrete type) while still allowing for injection tokens to be 
  abstract. Fixes an issue where `inject()` could not accept an abstract class, even though that is a common pattern
  for swappable injectables.
# v3.5.2
- `@/runtime`: `ExecutionContext.current.application` is now available before `altOnInit` runs

# v3.5.1
- `@/logging`: `Logger.current` does not use the `Logger` instance configured in application injector

# v3.5.0
- `@/di`: `inject()` now supports `skipSelf`, `self`, and `optional` options.
- `@/web-server`
    * Add support for SNI
    * Add support for serving both HTTP and HTTPS via a secondary port
- `@/fastify`
    * Fix missing support for Alterior seamless websockets
    * Fix missing support for Alterior TLS certificate generation
    * Fix missing support for serving TLS/SPDY

# 3.4.2
- `@/platform-nodejs`: Add support for `dotenv-flow` style usage of the `NODE_ENV` environment variable. When `NODE_ENV`
  is set, the filename searched is `.env.{NODE_ENV}` to allow you to configure multiple environments in separate `.env`
  files.

# 🚀3.4.0
- `@/di`: Support for imperative injection via the `inject()` function.

# 🚀3.3.0
- `@/web-server`: Request logging has been improved, and is now highly customizable. Support has been added for filtering
  sensitive parameters during request logging.

# 🚀3.2.0
- All packages now depend on RxJS 7.8.0 or later.

# 🚀3.1.15
- `@/common`: `clone()` Now properly handles undefined/null and primitive values

# 🚀3.1.14
- `@/web-server`: Support path-limited middleware

# 🚀3.1.13
- `@/web-server`: Fix a memory leak when many requests are processed in a single HTTP session

# 🚀3.1.12
- `@/logging`: It is now possible to change the configured log listeners on the fly
- `@/terminal`: Introducing the `TerminalUI` class which can be used to create real-time terminal UI applications

# 🚀3.1.11
- `@/terminal`: Accept numbers (in addition to strings) in `style` functions

# 🚀3.1.8
- `@/terminal`: Fixes some issues in the implementation of `read`

# 🚀3.1.7
- `@/terminal`: Introduced

# 🚀3.1.6
- `@/annotations`: Fixes a bug where method decorators would be misapplied if the name of the method was the same as the name of a method of the Array class

# 🚀3.1.5
- `@/platform-angular`: Supports more Angular versions

# 🚀3.1.3
- `@/common`: Fixes an issue in `Base64` which caused incorrect padding to be applied 

# 🚀3.1.0

- Minimum Node.js version is now 14
- Updated dependencies
- Cleans up a number of unused dependencies
- Now uses NPM workspaces for managing the Alterior codebase

# 🚀3.0.6
- `@/common`: Fixes several bugs in the `Base64` class

# 🚀 3.0.5

- `@/web-server`: Fixes a crash in `WebEvent.request` et al when called outside of an `@alterior/web-server` request context
- `@/platform-nodejs`: Support loading `.env` files from parent directories of the current working directory

# 🚀 3.0.4

- `@/web-server`: Remove `@types/supertest` dependency

# 🚀 3.0.3

- Properly expose `@alterior/cli` types

# 🚀 3.0.2

- Released all packages under 3.0.2 for consistency

# 🚀 3.0.1

- Fixed an issue where `console` patch did not work properly on the web

# 🚀 3.0.0

Final release of Alterior v3

# 🚀 3.0.0-rc.9

- `@/web-server`: The message attached to `HttpError` will now hint that you shouldn't be catching this error, since 
  it's used for aborting the active request and sending an HTTP status codse
- `@/web-server`: When `WebServer.for()` fails to resolve the current `WebServer` instance, an error is now thrown 
  instead of returning `undefined`. This helps to identify "split brain" packaging issues, most commonly when using 
  `npm link` or other developer tooling.
- `@/platform-angular`: List peer dependency support for Angular 10, 11, 12, 13, and 14

# 🚀 3.0.0-rc.8
- Bugfix: Wait until web service engine start is complete before proceeding

# 🚀 3.0.0-rc.7
- `@/web-server`: `WebServer#httpServer` is now public (read only)
- `@/web-server`: Service classes can now receive an `altOnListen(server : WebServer)` event, useful for configuring
  aspects of the underlying Node.js http.Server instance directly.

# 🚀 3.0.0-rc.6

- Alterior is now built using Typescript 4.5.4, previous versions used Typescript 4.1.5.
- `@alterior/platform-nodejs` now provides a global implementation of `WebSocket` implementation using `ws` if one is
  not already available
- Fixes `deepClone()` to handle cyclical object graphs correctly
- The `@SessionValue()` parameter decorator has been removed in preparation for the 3.0.0 release. This decorator was 
  deprecated in `v3.0.0-beta.76` released on 2/27/2021. Use the `Session` class instead.
- Added `@QueryParams()` parameter decorator as a way to get a `Record<string,string>` containing all query parameters
  passed via URL. You can use a specific interface type for such parameters, but please note that Alterior does not 
  perform automatic coercion of the fields of the `@QueryParmas()` object- all values will be strings.
- The `accessControl()` built-in middleware has been removed in preparation for the 3.0.0 release. This feature was
  deprecated in `v3.0.0-beta.2` released on 9/6/2018. Please use a Connect-compatible middleware package or create
  your own instead. Feel free to start from Alterior's implementation, you can find it
  at https://github.com/alterior-mvc/alterior/blob/c4e6730c98d7f2a6d20764612af0b7b2cd51c1e6/packages/web-server/src/accesscontrol.ts.
- The `@Request()` parameter decorator has been removed in preparation for the 3.0.0 release. This decorator was deprecated in `v3.0.0-beta.76` released on 2/27/2021. Use `WebEvent.request` instead to access parameters of the underlying HTTP request.
- The `RolesService#getRoleForModule()` method has been renamed to `RolesService#getForModule()`
- `RolesService#getById()` has been added.
- The `RolesService#start()` and `RolesService#stop()` methods have been removed. Use `RolesService#getById()` or 
  `RolesService#getForModule()` and call `start`/`stop` on the resulting `Role` object instead.
  
# 🚀 3.0.0-rc.5

- Documentation improvements
- Factors out Express and Fastify specific code to `@alterior/express` and `@alterior/fastify`. As part of this, 
  you must now import `@alterior/express` or `@alterior/fastify` and specify it as the web server engine from this 
  version on. For example:
  ```typescript
  // main.ts
  import { WebServerEngine } from '@alterior/web-server';
  import { ExpressEngine } from '@alterior/express';

  WebServerEngine.default = ExpressEngine;
  ```
  Alternatively you can specify an engine via dependency injection:
  ```typescript
  @WebService({
      providers: [
          { provide: WebServerEngine, useClass: ExpressEngine }
      ]
  })
  export class MyService {
      // ...
  }
  ```
  This change reduces the complexity of Alterior's dependency tree by ensuring that excess web server dependencies 
  will not be present (ie fastify on an express app or express on a fastify app). It also fixes an issue where Alterior
  users were required to install a lot of Express-related `@types/*` packages to avoid Typescript errors during 
  development.

`@/annotations`
- The `@NgMetadataName()` and related Angular compatibility features have been entirely removed. They do not work with 
  newer versions of Angular. The recommended way to use Alterior with Angular is via `@alterior/platform-angular`

`@/runtime`
- The `--self-test` option no longer starts the application (so the `OnStart` lifecycle method does not execute)

`@/web-server`
- Adds support for `boolean` values on input parameters (ie `@QueryParam()`) when a parameter annotated with `boolean` 
  type is used. The values `''`, `'no'`, `'0'`, `'false'`, and `'off'` produce `false`, all other values produce `true`.
- Adds support for `Date` values on input parameters (ie `@QueryParam` et al) when a parameter annotated with `Date` 
  type is used. Any string value that produces a valid `Date` object via `new Date(str)` will be accepted, otherwise a 
  `400 Bad Request` will be returned without executing the route method. Caution: Because this accepts values in milliseconds (not seconds), it is not suitable for receiving UNIX timestamps.
- Adds support for receiving the ID for the request from a request header (ie `X-Trace` or so). Not enabled by 
  default. Use `requestIdHeader` option when configuring the web server to enable this functionality.
- Fixes an issue where request ID was wastefully generated twice
- Removed the `engine` option from `WebServerOptions`. Either set `WebServerEngine.default` or provide 
  `WebServerEngine` as a dependency to specify the web engine. See above for details.
- `@QueryParam()` no longer requires the `name` parameter. Similar to the offer input decorators, `@QueryParam()` 
  already supported auto-detecting `name`, this just adjusts the function signature to match the behavior.
- `CertificateGenerator` is now properly exported for external use
- Routes which do not return any result content now generate `204 No Content`, provided the headers have not already 
  been sent, and the status code selected by the end of the request is `200 OK`. If you need to return an empty body 
  with status `200 OK` instead of `204 No Content`, call `WebEvent.response.end()` before completing the request.

# 🚀 3.0.0-rc.4

`@/common`
- Adds ability to get an entry from `Cache<T>` without doing a fetch operation
- Fixes an issue with `Cache<T>` where `null` and `undefined` are cached incorrectly. `null` now caches correctly and 
  `undefined` is never cached.

# 3.0.0-rc.2
> 3.0.0-rc.3 hotfixes CommonJS support via downgrade to node-fetch@2

`@/platform-nodejs`
- `fetch()` is now made available globally using `node-fetch`

# 3.0.0-rc.1

- First release candidate for v3.0.0
