const getParameterNames = require('@avejidah/get-parameter-names');
import * as express from 'express';
import * as uuid from 'uuid';

import { IAnnotation } from "@alterior/annotations";
import { InputAnnotation } from "./input";
import { RouteEvent, RouteDefinition, RouteOptions } from "./metadata";
import { ReflectiveInjector, Provider, Injector } from '@alterior/di';
import { prepareMiddleware } from "./middleware";
import { Annotations } from "@alterior/annotations";
import { WebServerSetupError, WebServer } from "./web-server";
import { HttpError, ArgumentError, ArgumentNullError } from "@alterior/common";
import { Response } from './response';

export interface RouteDescription {
	definition : RouteDefinition;

	httpMethod : string;
	method? : string;
	path : string;
	group? : string;
	
	description? : string;
	parameters? : RouteParamDescription[];
}

export interface RouteParamDescription {
	name : string;
	type : string;
	description? : string;
	required? : boolean;
}

export interface RouteMethodMetadata {
	returnType : any;
	paramTypes : any[];
	paramNames : any[];
	pathParamNames : any[];
	paramAnnotations : IAnnotation[][];
}

/**
 * Represents a parameter of a route-handling Typescript method. 
 */
export class RouteMethodParameter<T = any> {
	constructor(
		readonly route : RouteInstance,
		readonly target : Function,
		readonly methodName : string,
		readonly index : number,
		readonly name : string,
		readonly type : any,
		readonly annotations : IAnnotation[]
	) {
		this.prepare();
	}

	get inputAnnotation() {
		return this.annotations.find(x => x instanceof InputAnnotation) as InputAnnotation;
	}
	
	private _factory : (ev : RouteEvent) => Promise<T>;
	public get factory() {
		return this._factory;
	}

	async resolve(ev : RouteEvent) {
		return await this._factory(ev);
	}

	private _description : RouteParamDescription;

	get description() {
		return this._description;
	}

	prepare() {
		let inputAnnotation = this.inputAnnotation;
		let paramName = this.name;
		let factory : (ev : RouteEvent) => any = null;
		let paramDesc = null;
		let paramType = this.type;
		let route = this.route;
		let simpleTypes = [String, Number];

		paramDesc = { 
			name: paramName, 
			type: null,
			description: `An instance of ${paramType}`
		};

		if (inputAnnotation) {
			paramDesc.type = inputAnnotation.type;

			let inputName = inputAnnotation.name || paramName;

			let typeFactories = {
				path: (ev : RouteEvent) => ev.request.params[inputName],
				query: (ev : RouteEvent) => ev.request.query[inputName],
				session: (ev : RouteEvent) => inputAnnotation.name ? 
					(ev.request['session'] || {})[inputAnnotation.name]
					: ev.request['session'],
				body: (ev : RouteEvent) => ev.request['body']
			};
			
			factory = typeFactories[inputAnnotation.type];
			
			if (!this.route.pathParameterMap[inputName])
				this.route.pathParameterMap[inputName] = paramDesc;

		} else if (paramType === RouteEvent) {
			factory = ev => ev;
		} 
		
		// Name based matching for path parameters

		if (!factory) {
			if (this.route.params.find(x => x == paramName) && simpleTypes.includes(paramType)) {
				factory = (ev : RouteEvent) => ev.request.params[paramName];
				paramDesc.type = 'path';
			}
		}

		// Well-known names

		if (!factory) {
			let paramNameFactories = {
				body: (ev : RouteEvent) => ev.request['body'],
				session: (ev : RouteEvent) => ev.request['session']
			};

			if (paramNameFactories[paramName]) {
				factory = paramNameFactories[paramName];
				paramDesc.type = paramName;
			}
		}

		if (!factory) {
			let sanitizedType = paramType ? (paramType.name || '<unknown>') : '<undefined>';
			throw new Error(
				`Unable to fulfill route method parameter '${paramName}' of type '${sanitizedType}'\r\n`
				+ `While preparing route ${this.route.definition.method} ${this.route.definition.path} ` 
				+ `with method ${this.route.definition.method}()`
			);
		}

		// Handle format...

		if (paramType === Number) {
			let originalFactory = factory;
			factory = ev => {
				let value = originalFactory(ev);
				let number = parseFloat(value);
				if (isNaN(number)) {
					throw new HttpError(400, [], {
						error: 'invalid-request',
						message: `The parameter ${paramDesc.name} must be a valid number`
					});
				}

				return number;
			}
		}

		if (paramType === String) {
			let originalFactory = factory;
			factory = ev => {
				let value = originalFactory(ev);
				if (value === undefined || value === null)
					return value;

				return ''+value;
			}
		}

		this._factory = factory;
		this._description = paramDesc;
	}
}

/**
 * Represents a Route instance
 */
export class RouteInstance {
	constructor(
		readonly server : WebServer,
		readonly controllerInstance : any,
        readonly injector : Injector,
        readonly parentMiddleware: any[],
        readonly parentGroup: string,
        readonly controllerType : Function,
        readonly routeTable : any[],
		readonly definition : RouteDefinition) 
	{
		this.prepare();
	}

	get params() {
		return this._params;
	}

	private _params : string[];

	private prepare() {

		// Add it to the global route list

		this.routeTable.push({
			controller: this.controllerType,
			route: this.definition
		});

		let routeParams = (this.definition.path || "").match(/:([A-Za-z][A-Za-z0-9]*)/g) || [];
		this._params = routeParams.map(x => x.substr(1));

		this.prepareMiddleware();
		this.prepareMethodMetadata();
		this.prepareParameters();
		this.prepareMetadata();
	}

	get options(): RouteOptions {
		return this.definition.options || {};
	}

	get group(): string {
		return this.options.group || this.parentGroup;
	}

	private _pathParameterMap = {};

	get pathParameterMap() {
		return this._pathParameterMap;
	}

	private prepareMetadata() {
		let route = this.definition;
		let routeDescription : RouteDescription = {
			definition: route,
			httpMethod: route.httpMethod,
			group: this.group,
			method: route.method,
			path: route.path,
			parameters: []
		};

		routeDescription.parameters.push(
			...this._methodMetadata.pathParamNames
				.map(id => <RouteParamDescription>{
					name: id.replace(/^:/, ''),
					type: 'path'
				})
				.map(desc => this.pathParameterMap[desc.name] = desc)
		);

		this._description = routeDescription;
		this.server.serviceDescription.routes.push(this.description);
	}

	private _description : RouteDescription;

	public get description() {
		return this._description;
	}

	private prepareMiddleware() {
		
		// Load up the defined middleware for this route
		let route = this.definition;
		let middleware = [].concat(route.options.middleware || []);

		// Ensure indexes are valid.

		let invalidIndex = middleware.findIndex(x => !x);
		if (invalidIndex >= 0)
			throw new Error(`Route '${route.path}' provided null middleware at position ${invalidIndex}`);

		// Procure an injector which can handle injecting the middlewares' providers

		let middlewareProviders : Provider[] = middleware.filter(x => Reflect.getMetadata('alterior:middleware', x));
		let childInjector = ReflectiveInjector.resolveAndCreate(middlewareProviders, this.injector);

		let args : any[] = [ route.path ];

		// Prepare the middlewares (if they are DI middlewares, they get injected)

		this.middleware = middleware;
		this.resolvedMiddleware = middleware.map(x => prepareMiddleware(childInjector, x));
	}

	middleware : any[];
	resolvedMiddleware : any[];

	private prepareMethodMetadata() {
		let controller = this.controllerType;
		let route = this.definition;

		let returnType = Reflect.getMetadata("design:returntype", controller.prototype, route.method);
		let paramTypes = Reflect.getMetadata("design:paramtypes", controller.prototype, route.method);
		let paramNames = getParameterNames(controller.prototype[route.method]);

		// Construct a set of easily addressable path parameter descriptions (pathParameterMap)
		// that can be decorated with insights from reflection later.

		let pathParamMatches = route.path.match(/:([A-Za-z0-9]+)/g) || [];
		let pathParamNames = Object.keys(pathParamMatches.reduce((pv, cv) => (pv[cv] = 1, pv), {}));

		this._methodMetadata = {
			returnType,
			paramTypes, 
			paramNames,
			pathParamNames,
			paramAnnotations: Annotations.getParameterAnnotations(controller, route.method, false)
		}
	}

	private _methodMetadata : RouteMethodMetadata;

	get methodMetadata() {
		return this._methodMetadata;
	}

	private prepareParameters() {
		let controller = this.controllerType;
		let route = this.definition;
		let sourceName = `${controller.name || controller}.${route.method}()`;
		let { returnType, paramTypes, paramNames, paramAnnotations } = this._methodMetadata;
		
		let paramFactories = [];
		//let pathParameterMap : any = {};

		if (!paramTypes) {
			paramFactories = [
				(ev : RouteEvent) => ev.request, 
				(ev : RouteEvent) => ev.response
			];
			return;
		}

		for (let i = 0, max = paramNames.length; i < max; ++i) {
			this._parameters.push(new RouteMethodParameter(
				this,
				this.controllerType,
				this.definition.method,
				i, 
				paramNames[i],
				paramTypes[i],
				paramAnnotations[i] || []
			));
		}

		let unresolvedParameters = this._parameters.filter(x => !x.factory);

		if (unresolvedParameters.length > 0) {
			let details = unresolvedParameters
				.map(x => `${x.name} : ${x.type || 'any'} (#${x.index + 1})`)
				.join(', ')
			;

			throw new WebServerSetupError(
				`Could not resolve some method parameters on ${sourceName}: ` 
				+ `${details}`
			);
		}

	}

	_parameters : RouteMethodParameter[] = [];

	get parameters() {
		return this._parameters.slice();
	}

	async logAndExecute(instance, event : RouteEvent) {
		let requestId = uuid.v4();
		return this.server.logger.withContext(
			{ host: 'web-server', requestId }, 
			`${this.definition.method.toUpperCase()} ${this.definition.path} | ${requestId}`, 
			() => {
				return this.execute(instance, event);
			}
		);
	}

	private async execute(instance, event : RouteEvent) {
		if (!instance) 
			throw new ArgumentNullError('instance');
		
		if (!instance[this.definition.method]) {
			throw new ArgumentError(
				'instance', 
				`Provided instance does not have an implementation ` 
				+ `for method ${this.definition.method}()`
			);
		}

		let route = this.definition;
		let controllerType = this.controllerType;

		// Execute our function by resolving the parameter factories into a set of parameters to provide to the 
		// function.

        this.server.reportRequest(event, `${controllerType.name}.${route.method}()`);

		let result;

		try {
			result = await instance[route.method](
				...(await Promise.all(this.parameters.map(x => x.resolve(event))))
			);
		} catch (e) {
			
			if (e.constructor === HttpError) {
				let httpError = <HttpError>e;
				event.response.status(httpError.statusCode);
				
				httpError.headers
					.forEach(header => event.response.header(header[0], header[1]));

				event.response.send(httpError.body);
				return;
			}

			this.server.handleError(e, event, this, `${controllerType.name}.${route.method}()`);
			return;
		}

		// Return value handling

		if (result === undefined) {
			event.response.end();
			return;
		}

		if (result === null) {
			this.server.engine.sendJsonBody(event, result);
			return;
		}

		try {
			if (result.constructor === Response) {
				let response = <Response>result;

				event.response.status(response.status);
				response.headers.forEach(x => event.response.header(x[0], x[1]));
				
				if (response.encoding === 'raw') {
					if (response.body instanceof Buffer)
						event.response.send(response.body);
					else if (typeof response.body === 'string')
						event.response.send(new Buffer(response.body)); 
					else if (response.body === undefined || response.body === null)
						event.response.send();
					else
						throw new Error(`Unknown response body type ${response.body}`);

				} else if (response.encoding === 'json') {
					this.server.engine.sendJsonBody(event, response.body);
				} else {
					throw new Error(`Unknown encoding type ${response.encoding}`);
				}

			} else {
				// event.response
				// 	.status(200)
				// 	.send(result)
				// ;

				event.response.status(200);
				this.server.engine.sendJsonBody(event, result);
			}
		} catch (e) {
			console.error(`Caught exception:`);
			console.error(e);

			throw e;
		}
	}

	/**
	 * Installs this route into the given Express application. 
	 * @param app 
	 */
	mount(pathPrefix : string) {
		this.server.addRoute(
			this.definition.httpMethod, 
			`${pathPrefix || ''}${this.definition.path}`,
			ev => this.logAndExecute(this.controllerInstance, ev), 
			this.resolvedMiddleware
		);
	}
}