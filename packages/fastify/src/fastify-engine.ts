import { ConnectApplication, MiddlewareDefinition, WebEvent, WebRequest, WebServerEngine } from '@alterior/web-server';

import fastify, { FastifyReply } from "fastify";
import * as http from 'http';

export type FastifyConnectMiddleware = ConnectApplication & fastify.FastifyInstance<http.Server, WebRequest, http.ServerResponse>;

export class FastifyEngine extends WebServerEngine {
	readonly app = <FastifyConnectMiddleware>fastify();
	readonly providers = [];

	override sendJsonBody(routeEvent : WebEvent, body : any) {
		routeEvent.response.setHeader('Content-Type', 'application/json');
		(routeEvent.response as unknown as FastifyReply<http.ServerResponse>)
			.send(body);
	}

	addConnectMiddleware(path : string, middleware : any) {
		this.app.use(path, middleware);
	}
	
	addRoute(method : string, path : string, handler : (event : WebEvent) => void, middleware?: MiddlewareDefinition[]) {
		if (!middleware)
			middleware = [];
		(this.app as any)[this.getRegistrarName(method)](
			path, 
			...middleware, 
			(req: WebRequest, res: http.ServerResponse) => {
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
