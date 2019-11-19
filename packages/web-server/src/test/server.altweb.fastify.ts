import "reflect-metadata";
import "zone.js";

import { WebService } from "../service";
import { Post, Get } from "../metadata";
import { Body } from "../input";
import { Application } from "@alterior/runtime";
import * as bodyParser from 'body-parser';
import { FastifyEngine } from "../web-server";

@WebService({
    server: {
        silent: true,
        engine: FastifyEngine,
        middleware: [ bodyParser.json() ]
    }
})
class Server {
    @Post('/')
    post(@Body() body) {
        return { saw: body.value };
    }
    
    @Get('/info')
    get() {
        return { service: 'test', version: '0.0.0' };
    }

    @Post('/exit')
    exit() {
        process.exit(0);
    }
}

Application.bootstrap(Server);