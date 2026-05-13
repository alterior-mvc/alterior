//require('wtfnode').init();

import "zone.js";
import "reflect-metadata";
import "source-map-support/register";

import { suite } from 'razmin';
import { ConnectApplication, ConnectMiddleware, ConnectMiddlewareH1, WebServerEngine } from "./web-server-engine";
import { WebEvent } from "./metadata";
import { ServerOwnedWebEvent, WebServerOptions } from "./web-server-options";
import * as http from 'http';

import express from "express";
import * as net from "net";
import { inject, Injectable } from '@alterior/di';
import { WebServer } from "./web-server";

@Injectable()
export class TestWebServerEngine extends WebServerEngine {
    private server = inject(WebServer);

    readonly express = express();
    readonly app = this.express as ConnectApplication; // TODO: Express does not technically support HTTP/2

    sendJsonBody(routeEvent: WebEvent, body: any) {
        routeEvent.response.setHeader('Content-Type', 'application/json; charset=utf-8');
        routeEvent.response.write(JSON.stringify(body))
        routeEvent.response.end();
    }

    private getRegistrarName(method: string) {
        let registrar = method.toLowerCase();
        if (!this.supportedMethods.includes(registrar))
            throw new Error(`The specified method '${method}' is not supported by Express.`);

        return registrar;
    }

    override addConnectMiddleware(path: string, middleware: ConnectMiddleware) {
        this.express.use(path, middleware as ConnectMiddlewareH1); // TODO: Express doesn't support H/2 yet.
    }

    override addRoute(method: string, path: string, handler: (event: WebEvent) => void, middleware?: ConnectMiddleware[]) {
        if (!middleware)
            middleware = [];

        (this.app as any)[this.getRegistrarName(method)](
            path, ...middleware,
            (req: express.Request, res: express.Response) => handler(new WebEvent(req, res))
        );
    }

    override addAnyRoute(handler: (event: ServerOwnedWebEvent) => void) {
        this.express.use((req, res) => handler(this.server.registerEvent(new WebEvent(req, res))));
    }
}


WebServerEngine.default = TestWebServerEngine;

suite()
    .withTimeout(10 * 1000)
    .include(['**/*.test.js'])
    .run()
    ;