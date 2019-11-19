import * as express from 'express';
import * as uuid from 'uuid';
import * as fastify from 'fastify';
import * as http from 'http';

import { Injector, ReflectiveInjector, Provider, Module } from "@alterior/di";
import { prepareMiddleware } from "./middleware";
import { RouteEvent } from "./metadata";
import { BaseErrorT } from "@alterior/common";
import { RouteDescription, RouteInstance } from './route';
import { ApplicationOptions, Application, AppOptionsAnnotation, AppOptions } from '@alterior/runtime';
import { ExpressRef } from './express-ref';
import { Logger } from '@alterior/logging';

export class WebServerSetupError extends BaseErrorT {
}

export interface WebServerOptions {
	port? : number;
	engine? : any;
    middleware? : Function[];
    hideExceptions? : boolean;
    verbose? : boolean;
	silent? : boolean;
	silentErrors? : boolean;
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

export abstract class WebServerEngine {
	readonly app : any;
	readonly providers : Provider[];
	abstract addConnectMiddleware(path : string, middleware : Function);
	abstract addRoute(method : string, path : string, handler : (event : RouteEvent) => void, middleware?);
	abstract listen(port : number) : Promise<http.Server>;
	abstract sendJsonBody(routeEvent : RouteEvent, body : any);
}

export class ExpressEngine implements WebServerEngine {
	constructor() {
		this.app = express();
	}

	app : express.Application;
	
	get providers() : Provider[] {
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

/**
 * Implements a web server which is comprised of a set of Controllers.
 */
export class WebServer {
    constructor(
        injector : Injector,
		options : WebServerOptions,
		readonly logger : Logger,
		readonly appOptions : ApplicationOptions = {}
    ) {
		this.setupServiceDescription();
		this.setupInjector(injector);
		this.options = options || {};
		this._engine = this._injector.get(WebServerEngine);

		this.installGlobalMiddleware();
	}
	
	private _injector : Injector;
    readonly options : WebServerOptions;
    private httpServer : http.Server;
	private _serviceDescription : ServiceDescription;
	private _engine : WebServerEngine;

	get engine() {
		return this._engine;
	}

	public static bootstrapCloudFunction(entryModule : any, options? : ApplicationOptions) {
		let appReady : Promise<Application>;
		let expressRef : ExpressRef = null;

		return async (req, res) => {
			if (!appReady) {
				let appOptionsAnnot = AppOptionsAnnotation.getForClass(entryModule);
				@AppOptions(appOptionsAnnot ? appOptionsAnnot.options : {})
				@Module({
					imports: [ entryModule ],
					providers: [
						{ provide: WebServerEngine, useClass: ExpressEngine }
					]
				})
				class EntryModule {
				}
		
				appReady = Application.bootstrap(
					EntryModule, 
					Object.assign({}, options, { 
						autostart: false 
					})
				);
			}

			if (!expressRef) {
				let app = await appReady;
				expressRef = app.injector.get(ExpressRef);
			}
			
		    expressRef.application(req, res);
		}
	}
	
	/**
	 * Setup the service description which provides a view of all the routes 
	 * registered in this web server.
	 */
	private setupServiceDescription() {
		let version = '0.0.0';
		if (this.appOptions.version)
			version = this.appOptions.version;

		this._serviceDescription = {
			routes: [],
			version
		};
	}

	/**
	 * Construct an injector suitable for use in this web server component,
	 * inheriting from the given injector.
	 * 
	 * @param injector 
	 */
	private setupInjector(injector : Injector) {
		let providers = [
			{
				provide: ServiceDescriptionRef,
				useValue: new ServiceDescriptionRef(this._serviceDescription)
			}
		];
		
		let ownInjector = ReflectiveInjector.resolveAndCreate(providers, injector);
		this._injector = ownInjector;
	}

	public get injector() {
		return this._injector;
	}

    // public get express() {
    //     return this.expressApp;
    // }

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
			this.engine.addConnectMiddleware('/', middleware as any);
        }
	}
	
    async start() {
		this.httpServer = await this.engine.listen(this.options.port || 3000);
    }

    stop() {
		if (!this.httpServer)
			return;
		
		this.httpServer.close();
    }

	reportRequest(event : RouteEvent, source : string) {
		if (!this.options.silent) {
			let req : any = event.request;
			let method = event.request.method;
			let path = event.request.path;

			// When using fastify as the underlying server, you must 
			// access route-specific metadata from the underlying Node.js 
			// request

			if (req.req) {
				if (!method)
					method = req.req.method;
				if (!path)
					path = req.req.path;
			}

			this.logger.info(`${method.toUpperCase()} ${path} => ${source}`);
		}
	}

	/**
	 * Installs this route into the given Express application. 
	 * @param app 
	 */
	addRoute(method : string, path : string, handler : (event : RouteEvent) => void, middleware = []) {
		this.engine.addRoute(method, path, ev => {
			let requestId = uuid.v4();
			return this.logger.withContext({ host: 'web-server', requestId }, `${method.toUpperCase()} ${path} | ${requestId}`, () => {
				return handler(ev);
			});
		}, middleware);
	}

	handleError(error : any, event : RouteEvent, route : RouteInstance, source : string) {

		if (this.options.onError)
			this.options.onError(error, event, route, source);

		if (this.options.handleError) {
			this.options.handleError(error, event, route, source);
			return;
		}

		if (!this.options.silentErrors) {
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
			.send(response)
		;
	}
}

