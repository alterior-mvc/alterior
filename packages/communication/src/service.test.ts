import { Service } from "./service";

describe('Service', () => {
    describe('define()', () => {
    });
    it('correctly maps the types of defined methods', () => {
        const FooInterface = Service('@blah/foo')
            .define(t => ({
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

        let x: FooInterface | undefined;

        x?.info('thing');
        // @ts-expect-error
        x?.info();
    })
});

