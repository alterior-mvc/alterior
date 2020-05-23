import fastify from "fastify";
import * as http from "http";
import { RouteEvent } from "./metadata";
import { WebServerEngine } from "./web-server-engine";

export class FastifyEngine implements WebServerEngine {
	constructor() {
		this._app = fastify({ })
	}

	get providers() {
		return [];
	}

	private _app : fastify.FastifyInstance<http.Server, http.IncomingMessage, http.ServerResponse>;

	get app() {
		return this._app;
	}

	sendJsonBody(routeEvent : RouteEvent, body : any) {
		routeEvent.response
			.header('Content-Type', 'application/json')
			.send(body)
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

		// TODO: bodyParser.json() cannot be used with fastify
		if (middleware.name === 'jsonParser')
			return;

		this.app.use(path, middleware);
	}
	
	async listen(port : number) {
		await this.app.listen(port);
		return this.app.server;
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
