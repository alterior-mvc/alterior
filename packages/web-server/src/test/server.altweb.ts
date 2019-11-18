import "reflect-metadata";
import "zone.js";

import { WebService } from "../service";
import { Post } from "../metadata";
import { Body } from "../input";
import { Application } from "@alterior/runtime";
import * as bodyParser from 'body-parser';

@WebService({
    server: {
        middleware: [ bodyParser.json() ]
    }
})
class Server {
    @Post('/')
    post(@Body() body) {
        return { saw: body.value };
    }

    @Post('/exit')
    exit() {
        process.exit(0);
    }
}

Application.bootstrap(Server);