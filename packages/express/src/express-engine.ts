import { Injectable } from '@alterior/di';
import { WebEvent } from "@alterior/web-server";
import { WebServerEngine } from "@alterior/web-server";

import express from "express";

@Injectable()
export class ExpressEngine extends WebServerEngine {
	readonly app: express.Application = express();
	readonly providers = [];
	
	addConnectMiddleware(path: string, middleware: any) {
		this.app.use(path, middleware);
	}

	addRoute(method: string, path: string, handler: (event: WebEvent) => void, middleware?) {
		if (!middleware)
			middleware = [];
			
		this.app[this.getRegistrarName(method)](
			path, ...middleware, 
			(req, res) => handler(new WebEvent(req, res))
		);
	}

	addAnyRoute(handler: (event: WebEvent) => void) {
		this.app.use((req, res) => handler(new WebEvent(req, res)));
	}

	private getRegistrarName(method: string) {
		let registrar = method.toLowerCase();
		if (!this.supportedMethods.includes(registrar))
			throw new Error(`The specified method '${method}' is not supported by Express.`);
			
		return registrar;
	}

}
