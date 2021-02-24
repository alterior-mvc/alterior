import express from "express";
import * as http from "http";
import * as net from "net";

import { WebEvent } from "./metadata";
import { WebServerEngine } from "./web-server-engine";

export class ExpressEngine implements WebServerEngine {
	constructor() {
		this.app = express();
	}

	app : express.Application;
	
	get providers() {
		return [];
	}

	sendJsonBody(routeEvent : WebEvent, body : any) {
		routeEvent.response
			.header('Content-Type', 'application/json')
			.send(JSON.stringify(body))
		;
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

	async listen(port : number) {
		let server = this.app.listen(port);
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
			path, 
			...middleware, 
			(req, res) => {
				return handler(new WebEvent(req, res));
			}
		);
	}
}
