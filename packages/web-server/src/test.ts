//require('wtfnode').init();

import "zone.js";
import "reflect-metadata";
import "source-map-support/register";

import { suite } from 'razmin';
import { WebServerEngine } from "./web-server-engine";
import { WebEvent } from "./metadata";
import { WebServerOptions } from "./web-server-options";
import * as http from 'http';

import express from "express";
import * as net from "net";
import { Injectable } from '@alterior/di';

@Injectable()
export class TestWebServerEngine implements WebServerEngine {
	app = express();
	
	get providers() {
		return [];
	}

	sendJsonBody(routeEvent : WebEvent, body : any) {
		routeEvent.response.setHeader('Content-Type', 'application/json; charset=utf-8');
		routeEvent.response.write(JSON.stringify(body))
		routeEvent.response.end();
	}

	private readonly supportedMethods = [ 
		"checkout", "copy", "delete", "get", "head", "lock", "merge", 
		"mkactivity", "mkcol", "move", "m-search", "notify", "options", 
		"patch", "post", "purge", "put", "report", "search", "subscribe", 
		"trace", "unlock", "unsubscribe",
	];
	
	private getRegistrarName(method : string) {
		let registrar = method.toLowerCase();
		if (!this.supportedMethods.includes(registrar))
			throw new Error(`The specified method '${method}' is not supported by Express.`);
			
		return registrar;
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
			req['__upgradeHead'] = head;
			res.assignSocket(req.socket);
			this.app(req, res);
		});

		return server;
	}
	
	addRoute(method : string, path : string, handler : (event : WebEvent) => void, middleware?) {
		if (!middleware)
			middleware = [];
			
		this.app[this.getRegistrarName(method)](
			path, ...middleware, 
			(req, res) => handler(new WebEvent(req, res))
		);
	}

	addAnyRoute(handler : (event : WebEvent) => void) {
		this.app.use((req, res) => handler(new WebEvent(req, res)));
	}
}


WebServerEngine.default = TestWebServerEngine;

suite()
    .withTimeout(10 * 1000)
    .include(['**/*.test.js'])
    .run()
;