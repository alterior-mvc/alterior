import * as express from 'express';

import { Injector } from "injection-js";
import { prepareMiddleware } from "./middleware";
import { RouteEvent } from "./metadata";
import { BaseErrorT } from "@alterior/common";
import { RouteDescription, RouteInstance } from './route';
import { Server } from 'http';

export class WebServerSetupError extends BaseErrorT {
}

export interface WebServerOptions {
    port? : number;
    middleware? : Function[];
    hideExceptions? : boolean;
    verbose? : boolean;
	silent? : boolean;
	onError? : (error : any, event : RouteEvent, route : RouteInstance, source : string) => void;
	handleError? : (error : any, event : RouteEvent, route : RouteInstance, source : string) => void;
}

export interface ServiceDescription {
	name? : string;
	description? : string;
	version? : string;
	routes? : RouteDescription[];
}

export class ServiceDescriptionRef {
	constructor(
		readonly description : ServiceDescription
	) {
	}
}

/**
 * Implements a web server which is comprised of a set of Controllers.
 */
export class WebServer {
    constructor(
        readonly injector : Injector,
        options : WebServerOptions
    ) {
        this.options = options || {};
		this.expressApp = express();
        this.installGlobalMiddleware();
    }

    readonly options : WebServerOptions;
    private expressApp : express.Application;
    private expressServer : Server;
	private _serviceDescription : ServiceDescription = {
		routes: [],
		version: '0.0.0'
	};

    public get express() {
        return this.expressApp;
    }

	get serviceDescription() {
		return this._serviceDescription;
	}

	/**
	 * Install the registered global middleware onto our Express 
	 * application.
	 */
    private installGlobalMiddleware() {
        let middlewares = this.options.middleware || [];
        for (let middleware of middlewares) {
            middleware = prepareMiddleware(this.injector, middleware);
            this.expressApp.use(middleware as any);
        }
	}
	
    start() {
        this.expressServer = this.express.listen(this.options.port || 3000);
    }

    stop() {
		if (!this.expressServer)
			return;
		
		this.expressServer.close();
    }

	reportRequest(event : RouteEvent, source : string) {
		if (!this.options.silent)
			console.info(`[${new Date().toLocaleString()}] ${event.request.path} => ${source}`);
	}
	
	handleError(error : any, event : RouteEvent, route : RouteInstance, source : string) {

		if (this.options.onError) {
			this.options.onError(error, event, route, source);
		}

		if (this.options.handleError) {
			this.options.handleError(error, event, route, source);
			return;
		}

		if (!this.options.silent) {
			console.error(`Error handling request '${event.request.path}'`);
			console.error(`Handled by: ${source}`);
			console.error(error);
		}

		let response : any = {
			message: 'An exception occurred while handling this request.'
		};

		if (!this.options.hideExceptions) {
			if (error.constructor === Error)
				response.error = error.stack;
			else
				response.error = error;
		}

		event.response
			.status(500)
			.send(JSON.stringify(response))
		;
	}
}

