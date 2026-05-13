import fastify, { FastifyInstance, FastifyReply } from "fastify";
import { WebEvent, WebServerEngine, ConnectMiddleware, ServerOwnedWebEvent, WebServer, ConnectApplication, RequestBase, ResponseBase } from '@alterior/web-server';

import * as http from 'http';
import { inject } from "@alterior/di";

export type FastifyConnectMiddleware = ConnectMiddleware & fastify.FastifyInstance<http.Server, http.IncomingMessage, http.ServerResponse>;

export class FastifyEngine extends WebServerEngine {
    private server = inject(WebServer);
    
	readonly fastify = <FastifyConnectMiddleware & FastifyInstance>fastify();
	readonly app = this.fastify as ConnectApplication;
	readonly providers = [];

	override sendJsonBody(routeEvent : WebEvent, body : any) {
		routeEvent.response.setHeader('Content-Type', 'application/json');
		(routeEvent.response as unknown as FastifyReply<http.ServerResponse>).send(body);
	}

	addConnectMiddleware(path : string, middleware : any) {
		this.fastify.use(path, middleware);
	}
	
	addRoute(method : string, path : string, handler : (event : WebEvent) => void, middleware?: ConnectMiddleware[]) {
		if (!middleware)
			middleware = [];
		(this.fastify as any)[this.getRegistrarName(method)](
			path, 
			...middleware, 
			(req: RequestBase, res: ResponseBase) => {
				return handler(new WebEvent(req, res));
			}
		);
	}

	addAnyRoute(handler : (event : ServerOwnedWebEvent) => void) {
		this.fastify.use((req, res) => handler(this.server.registerEvent(new WebEvent(<any>req, <any>res))));
	}

	private getRegistrarName(method : string) {
		let registrar = method.toLowerCase();
		if (!this.supportedMethods.includes(registrar))
			throw new Error(`The specified method '${method}' is not supported by Express.`);
			
		return registrar;
	}
}
