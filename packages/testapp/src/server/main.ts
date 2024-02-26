import '@alterior/platform-nodejs';
import '@alterior/express';

import { HttpError, timeout } from '@alterior/common';
import { Application, Constructor } from '@alterior/runtime';
import { Get, Mount, OpenApiController, WebEvent, WebServer, WebService } from '@alterior/web-server';

type Method = (...args: any[]) => any;
type Methods<T> = { readonly [P in keyof T as T[P] extends Method ? P : never]: T[P]; }
type Props<T> = { [P in keyof T as T[P] extends Method ? never : P]: T[P]; }
export type ServiceInterface<T> = Methods<T> & Props<T>;

function Service<DefinitionT extends ServiceClientConstructor<ConcreteT>, ConcreteT>(iface: DefinitionT) {
    return (target: Constructor<ConcreteT>) => {}
}

type ServiceClientConstructor<T> = {
    new (endpoint: string): ServiceInterface<T>;
    ['interface']: ServiceInterface<T>;
}

Service.define = <T>(details: T): ServiceClientConstructor<T> => {
    return <any> undefined;
};

Service.method = <P extends Array<any>, R>(...decorators: MethodDecorator[]): (...args: P) => Promise<R> => {
    return <any>undefined;
};

////////////////////////////////////////////////////////////////////////////////

const FooInterface = Service.define({
    foo: Service.method<[size: number], void>()
});
type FooInterface = typeof FooInterface.interface;

@Service(FooInterface)
export class FooConcrete {
    async foo(size: number) {
        
    }
}

let x = new FooInterface('blah');
let y: FooInterface;

y = x;


x.foo(123);






@WebService()
export class MyService {
    @Mount('/openapi')
    openapi!: OpenApiController;
    
    @Get()
    async info() {
        return {
            server: 'wat',
            version: '1.2.3?'
        }
    }

    @Get('/test')
    async testRoute() {
        return { route: '/test' };
    }

    @Get('/test/number/:num')
    async testNumberRoute(num: number) {
        return { route: `/test/number/${num}` };
    }

    @Get('/uncaught')
    async uncaughtError() {
        throw new Error('Uncaught error');
    }

    @Get('/long')
    async longRoute() {
        await timeout(1500);
        return { message: 'finally done!' };
    }

    @Get('/hung')
    async hungRoute() {
        await timeout(3500);
        return { message: 'finally done!' };
    }

    @Get('/test/:param')
    async testRoute2(param: string) {
        return { route: `/test/${param}`, param };
    }

    @Get('/sse')
    async sse() {
        while (WebEvent.connected) {
            await timeout(1000);
            await WebEvent.sendEvent({ event: 'ping', data: { message: 'are you still there?' } });
        }
    }
    
    @Get('/socket')
    async socket() {
        if (WebEvent.request.headers['x-fail'] === 'yes')
            throw new HttpError(400, { message: 'nah' }, []);
        
        let socket = await WebServer.startSocket();
        socket.addEventListener('message', ev => {
            console.log(`Received websocket message:`);
            console.dir(ev.data);
        });
    }
}

Application.bootstrap(MyService);