# @/express

Provides the Express web server engine for Alterior and allows for access to Express' state within an Alterior app. 

# Usage

Installing Express as the default server engine happens automatically as soon as you import this library, provided
you have not already installed some other server engine as default.

```typescript
import '@alterior/express';
```

You can also manually perform this step using:

```ts
import { ExpressEngine } from '@alterior/express';
import { WebServerEngine } from '@alterior/web-server';

WebServerEngine.default = ExpressEngine;
```

Accessing the Express request/response:

```typescript
import { ExpressContext } from '@alterior/express';

@WebService() 
export class MyService {
    @Get()
    info() {
        console.log(`user agent is: ${ExpressContext.request.header('User-Agent')}`);
    }
}
```
