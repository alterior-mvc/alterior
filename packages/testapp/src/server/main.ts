import '@alterior/platform-nodejs';

import { HttpError, timeout } from '@alterior/common';
import { Application } from '@alterior/runtime';
import { Get, Mount, OpenApiController, WebEvent, WebServer, WebService } from '@alterior/web-server';

import '@alterior/express';

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