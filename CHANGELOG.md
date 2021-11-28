# ⏭ vNext

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

`@/runtime`
- The `--self-test` option no longer starts the application (so the `OnStart` lifecycle method does not execute)

`@/web-server`
- Adds support for automatic conversion of boolean values when using `@QueryParam()` on a parameter of type `boolean`.
  The values `''`, `'no'`, `'0'`, `'false'`, and `'off'` produce `false`, all other values produce `true`.
- Adds support for receiving the ID for the request from a request header (ie `X-Trace` or so). Not enabled by default. 
  Use `requestIdHeader` option when configuring the web server to enable this functionality.
- Fixes an issue where request ID was wastefully generated twice
- Removed the `engine` option from `WebServerOptions`. Either set `WebServerEngine.default` or provide `WebServerEngine` 
  as a dependency to specify the web engine. See above for details.

# 🚀 3.0.0-rc.4

`@/common`
- Adds ability to get an entry from `Cache<T>` without doing a fetch operation
- Fixes an issue with `Cache<T>` where `null` and `undefined` are cached incorrectly. `null` now caches correctly and `undefined` is never cached.

# 3.0.0-rc.2
> 3.0.0-rc.3 hotfixes CommonJS support via downgrade to node-fetch@2

`@/platform-nodejs`
- `fetch()` is now made available globally using `node-fetch`

# 3.0.0-rc.1

- First release candidate for v3.0.0