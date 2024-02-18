import "zone.js";
import "reflect-metadata";
import "source-map-support/register";

import { suite } from 'razmin';
import { WebServerEngine } from "./web-server-engine";
import { MiddlewareDefinition, WebEvent, WebRequest } from "./metadata";
import { WebServerOptions } from "./web-server-options";

import express, { Express } from "express";

import * as http from 'http';
import * as net from "net";

export class TestWebServerEngine extends WebServerEngine {
	app = express();

	sendJsonBody(routeEvent : WebEvent, body : any) {
		routeEvent.response.setHeader('Content-Type', 'application/json; charset=utf-8');
		routeEvent.response.write(JSON.stringify(body))
		routeEvent.response.end();
	}
	
	private getRegistrarName(method : string): keyof Express {
		let registrar = method.toLowerCase();
		if (!this.supportedMethods.includes(registrar))
			throw new Error(`The specified method '${method}' is not supported by Express.`);
			
		return <keyof Express>registrar;
	}

	addConnectMiddleware(path : string, middleware : any) {
		this.app.use(path, middleware);
	}

	async listen(options : WebServerOptions) {
		let server : http.Server;
		let protocols = ['http/1.1', 'http/1.0'];

		if (options.protocols)
			protocols = options.protocols;
		
		server = http.createServer(this.app);
		server.listen(options.port);

		server.on('upgrade', (req : http.IncomingMessage, socket : net.Socket, head : Buffer) => {
			let res = new http.ServerResponse(req);
			(req as any)['__upgradeHead'] = head;
			res.assignSocket(req.socket);
			this.app(req, res);
		});

		return server;
	}
	
	addRoute(method : string, path : string, handler : (event : WebEvent) => void, middleware?: MiddlewareDefinition[]) {
		if (!middleware)
			middleware = [];
			
		this.app[this.getRegistrarName(method)](
			path, ...middleware, 
			(req: WebRequest, res: http.ServerResponse) => handler(new WebEvent(req, res))
		);
	}

	addAnyRoute(handler : (event : WebEvent) => void) {
		this.app.use((req: WebRequest, res: http.ServerResponse) => handler(new WebEvent(req, res)));
	}
}


WebServerEngine.default = TestWebServerEngine;

suite()
    .withTimeout(10 * 1000)
	.withOptions({
		execution: {
			verbose: true
		}
	})
    .include(['**/*.test.js'])
    .run()
;