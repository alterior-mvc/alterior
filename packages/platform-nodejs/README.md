# @alterior/platform-nodejs

Simplifies idiomatic setup of a Node.js environment for 
running Alterior applications.

## Important note

You must still ensure you enable `experimentalDecorators` and `emitDecoratorMetadata` in your tsconfig.json to properly run Alterior applications.

## Usage

Within your entry point (usually `main.ts`):

```typescript
import '@alterior/platform-nodejs'; // must be first!
import { Application } from '@alterior/runtime';

// other imports here...

Application.bootstrap(MyModule);
```
**Important**: Make sure `import '@alterior/platform-nodejs';` is the first line in your entrypoint (`main.ts`).

## What does it do?

This does a number of things for you:
- Loads `zone.js` as early as possible to
  ensure all code properly runs within the root Zone.
- Loads `reflect-metadata` as early as possible to 
  ensure all subsequently loaded code has Typescript
  reflection metadata emitted
- Loads `source-map-support/register` as early as possible 
  to ensure any stack traces are shown using the available 
  source maps (this avoids seeing compiled JS files in stack traces, instead showing the original source file locations).
- Loads `dotenv/config` as early as possible to ensure that 
  any `dotenv` files are properly accounted for within `process.env`.
- Makes `fetch()` available globally (when not already provided). Does this with `globalThis.fetch = require('node-fetch')`
- Makes `WebSocket` available globally (when not already provided)