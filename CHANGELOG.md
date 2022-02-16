# ⏭ vNext

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