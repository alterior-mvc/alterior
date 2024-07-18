# @/communication

> 🚧 EXPERIMENTAL

A general purpose service communication framework which supports several underlying messaging systems (including HTTP).

```typescript
///////////////////////////////////////////////////////////////////

// PROBLEM: All of this loses the decorator metadata. We could force 
// the implementation method to have a decorator on it (would double for 
// ensuring the developer doesn't forget that the method is published),
// but the generated client would then not have this information at runtime.
// The client needs this information in order to create an HTTP request

const FooInterface = Service.define(t => ({
        info: t.method<[thing: string], { description: string }>(
            t.documentation({
                summary: 'Provides information about the given thing'
            })
        )
    }))
    .http(r => [
        r.get('/:thing').bind((r, i) => i.info(r.path('thing')))
    ])
;

type FooInterface = typeof FooInterface.interface;

@Service(FooInterface)
export class FooConcrete {
    async info(thing: string) {
        return { description: `That thing is named ${thing}` };
    }
}

let x = new FooInterface('blah');
let y: FooInterface;

y = x;
```