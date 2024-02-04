# @/fastify

Provides the Fastify web server engine for Alterior and allows for access to Fastify's state within an Alterior app. 

# Usage

Installing Fastify as the default server engine happens automatically as soon as you import this library, provided
you have not already installed some other server engine as default.

```typescript
import '@alterior/fastify';
```

You can also manually perform this step using:

```ts
import { FastifyEngine } from '@alterior/fastify';
import { WebServerEngine } from '@alterior/web-server';

WebServerEngine.default = FastifyEngine;
```

Accessing the Fastify request/response:

```typescript
import { FastifyContext } from '@alterior/fastify';

@WebService() 
export class MyService {
    @Get()
    info() {
        console.log(`user agent is: ${FastifyContext.request.header('User-Agent')}`);
    }
}
```
