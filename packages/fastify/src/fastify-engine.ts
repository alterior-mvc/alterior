import fastify, { FastifyInstance } from "fastify";
import { WebEvent, WebServerEngine, WebServerOptions, ConnectMiddleware } from '@alterior/web-server';
import * as http from 'http';

export type FastifyConnectMiddleware = ConnectMiddleware & fastify.FastifyInstance<http.Server, http.IncomingMessage, http.ServerResponse>;

export class FastifyEngine implements WebServerEngine {
	app = <FastifyConnectMiddleware>fastify();

	providers = [];

	sendJsonBody(routeEvent : WebEvent, body : any) {
		routeEvent.response.setHeader('Content-Type', 'application/json');
		routeEvent.response['send'](body);
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

		this.app['use'](path, middleware);
	}
	
	async listen(options : WebServerOptions) {
		await this.app.listen(options.port);
		return this.app.server;
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

	addAnyRoute(handler : (event : WebEvent) => void) {
		this.app.use((req, res) => handler(new WebEvent(<any>req, <any>res)));
	}
}
