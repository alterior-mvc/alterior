import 'zone.js';
import 'reflect-metadata';

import { WebService, Get, WebServer, WebEvent } from '@alterior/web-server';
import { Application } from '@alterior/runtime';
import { HttpError, timeout } from '@alterior/common';

@WebService()
export class MyService {
    @Get()
    async info() {
        return {
            server: 'wat',
            version: '1.2.3?'
        }
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
        if (WebEvent.request.header('X-Fail') === 'yes')
            throw new HttpError(400, { message: 'nah' }, []);
        
        let socket = await WebServer.startSocket();
        socket.addEventListener('message', ev => {
            console.log(`Received websocket message:`);
            console.dir(ev.data);
        });
    }
}

Application.bootstrap(MyService);