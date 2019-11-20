import "reflect-metadata";
import "zone.js";

import { WebService } from "../service";
import { Post, Get, Mount } from "../metadata";
import { Body } from "../input";
import { Application } from "@alterior/runtime";
import * as bodyParser from 'body-parser';
import { OpenApiController } from "../openapi";
import { ExpressEngine } from "../express-engine";

@WebService({
    name: 'Alterior Load Testing (Express)',
    server: {
        silent: true,
        engine: ExpressEngine,
        middleware: [ bodyParser.json() ]
    }
})
class Server {
    @Mount('/openapi')
    openapi : OpenApiController;

    /**
     * Get the 'value' property of body and echo it back
     */
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