import * as express from "express";
import { RouteEvent } from "./metadata";
import { WebServerEngine } from "./web-server-engine";

export class ExpressEngine implements WebServerEngine {
	constructor() {
		this.app = express();
	}

	app : express.Application;
	
	get providers() {
		return [];
	}

	sendJsonBody(routeEvent : RouteEvent, body : any) {
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
		return this.app.listen(port);
	}
	
	addRoute(method : string, path : string, handler : (event : RouteEvent) => void, middleware?) {
		if (!middleware)
			middleware = [];
			
		this.app[this.getRegistrarName(method)](
			path, 
			...middleware, 
			(req, res) => {
				return handler(new RouteEvent(req, res));
			}
		);
	}
}
