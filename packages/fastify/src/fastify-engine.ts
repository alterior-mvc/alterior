import fastify, { FastifyInstance } from "fastify";
import { WebEvent, WebServerEngine, ConnectMiddleware } from '@alterior/web-server';

import * as http from 'http';

export type FastifyConnectMiddleware = ConnectMiddleware & fastify.FastifyInstance<http.Server, http.IncomingMessage, http.ServerResponse>;

export class FastifyEngine extends WebServerEngine {
	readonly app = <FastifyConnectMiddleware & FastifyInstance>fastify();
	readonly providers = [];

	override sendJsonBody(routeEvent : WebEvent, body : any) {
		routeEvent.response.setHeader('Content-Type', 'application/json');
		routeEvent.response['send'](body);
	}

	addConnectMiddleware(path : string, middleware : any) {
		this.app.use(path, middleware);
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

	private getRegistrarName(method : string) {
		let registrar = method.toLowerCase();
		if (!this.supportedMethods.includes(registrar))
			throw new Error(`The specified method '${method}' is not supported by Express.`);
			
		return registrar;
	}
}
