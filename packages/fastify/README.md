# @/express

Access Express state within an Alterior app. 

# Why?

`@alterior/web-server` provides `WebEvent.request` which exposes the HTTP request object of the underlying web server framework being used. Alterior supports more than one framework, including `express` and `fastify`. Technically the minimum shape of `WebEvent.request` is that of the `request` object defined by the Node.js `http` module. As an app developer which uses Express as the server framework in my Alterior app, I want to access `WebEvent.request` with a Typescript type that exposes all that Express provides, not just as a generic Node.js `http` request object. I don't want to manually cast this object whenever I use it.

Since `WebEvent.request` is static (using the HTTP request's Zone to determine the appropriate value), we can create new ways to access this value which are appropriately typed.

Splitting this functionality into a specific package lets us remove unused code when not using Express.

# How

```typescript
import { ExpressContext } from '@alterior/express';
// ...

@WebService() 
export class MyService {
    @Get()
    info() {
        console.log(`user agent is: ${ExpressContext.request.header('User-Agent')}`);
    }
}
```
