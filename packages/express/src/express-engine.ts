import { inject, Injectable } from '@alterior/di';
import { ConnectApplication, ConnectMiddleware, RequestBase, ResponseBase, ServerOwnedWebEvent, WebEvent, WebServer } from "@alterior/web-server";
import { WebServerEngine } from "@alterior/web-server";

import express from "express";

@Injectable()
export class ExpressEngine extends WebServerEngine {
    private server = inject(WebServer);

	readonly express = express();
	readonly app = this.express as ConnectApplication;
	readonly providers = [];
	
	addConnectMiddleware(path: string, middleware: any) {
		this.express.use(path, middleware);
	}

	addRoute(method: string, path: string, handler: (event: WebEvent) => void, middleware?: ConnectMiddleware[]) {
		if (!middleware)
			middleware = [];
			
		(this.app as any)[this.getRegistrarName(method)](
			path, ...middleware, 
			(req: RequestBase, res: ResponseBase) => handler(new WebEvent(req, res))
		);
	}

	addAnyRoute(handler: (event: ServerOwnedWebEvent) => void) {
		this.express.use((req, res) => handler(this.server.registerEvent(new WebEvent(req, res))));
	}

	private getRegistrarName(method: string) {
		let registrar = method.toLowerCase();
		if (!this.supportedMethods.includes(registrar))
			throw new Error(`The specified method '${method}' is not supported by Express.`);
			
		return registrar;
	}

}
