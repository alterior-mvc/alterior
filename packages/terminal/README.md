# @alterior/terminal

Provides utilities useful for terminal applications, including reading input and styling output.

# Reading input

```typescript
import { read } from '@alterior/terminal';

let name = await read({ prompt: `What's your name? ` });

console.log(`Hello ${name}!`);
```

# Styling output

```typescript
import { styled, style } from '@alterior/terminal';

console.log(
    styled(`Hello `, style.$blue(`world`), `, how are `, style.$green(`you`), `?`)
);

```