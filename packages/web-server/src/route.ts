import * as bodyParser from 'body-parser';
import { IAnnotation } from "@alterior/annotations";
import { InputAnnotation } from "./input";
import { WebEvent, RouteDefinition, RouteOptions } from "./metadata";
import { Injector } from '@alterior/di';
import { MiddlewareProvider, prepareMiddleware } from "./middleware";
import { Annotations } from "@alterior/annotations";
import { WebServer } from "./web-server";
import { WebServerSetupError } from "./web-server-setup-error";
import { HttpError, ArgumentError, ArgumentNullError, getParameterNames, isConstructor } from "@alterior/common";
import { Response } from './response';
import { ellipsize } from './utils';
import { ConnectMiddleware } from './web-server-engine';
import { Interceptor } from './web-server-options';

export interface RouteDescription {
	definition : RouteDefinition;

	httpMethod : string;
	method? : string;
	path : string;
	pathPrefix? : string;
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
	
	private _factory : (ev : WebEvent) => Promise<T>;
	public get factory() {
		return this._factory;
	}

	async resolve(ev : WebEvent) {
		return await this._factory(ev);
	}

	private _description : RouteParamDescription;

	get description() {
		return this._description;
	}

	prepare() {
		let inputAnnotation = this.inputAnnotation;
		let paramName = this.name;
		let factory : (ev : WebEvent) => any = null;
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
				path: (ev : WebEvent) => ev.request['params'] ? ev.request['params'][inputName] : undefined,
				queryParam: (ev : WebEvent) => ev.request['query'] ? ev.request['query'][inputName] : undefined,
				queryParams: (ev : WebEvent) => ev.request['query'] ?? {},
				session: (ev : WebEvent) => inputAnnotation.name ? 
					(ev.request['session'] || {})[inputAnnotation.name]
					: ev.request['session'],
				body: (ev : WebEvent) => ev.request['body']
			};
			
			factory = typeFactories[inputAnnotation.type];
			
			if (!this.route.pathParameterMap[inputName])
				this.route.pathParameterMap[inputName] = paramDesc;

			if (inputAnnotation.default !== void 0) {
				let originalFactory = factory;
				factory = (ev : WebEvent) => originalFactory(ev) ?? inputAnnotation.default;
			}

		} else if (paramType === WebEvent) {
			factory = ev => ev;
		} 
		
		// Name based matching for path parameters

		if (!factory) {
			if (this.route.params.find(x => x == paramName) && simpleTypes.includes(paramType)) {
				factory = (ev : WebEvent) => ev.request['params'] ? ev.request['params'][paramName] : undefined;
				paramDesc.type = 'path';
			}
		}

		// Well-known names

		if (!factory) {
			let paramNameFactories = {
				body: (ev : WebEvent) => ev.request['body'],
				session: (ev : WebEvent) => ev.request['session']
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
				+ (this.route.params.find(x => x == paramName) 
					? `There is a path parameter (:${paramName}) but it was not bound because `
					  + `the method parameter is not one of ${simpleTypes.map(x => x.name).join(', ')}.\r\n`
					: ``
				  )
				+ `While preparing route ${this.route.definition.method} ${this.route.definition.path} ` 
				+ `with method ${this.route.definition.method}()`
			);
		}

		// Handle format...

		if (paramType === Number) {
			let originalFactory = factory;
			factory = ev => {
				let value = originalFactory(ev);

				// Do not try to validate `undefined` (ie the parameter is not present)
				
				if (value === void 0)
					return value;
				
				let number = parseFloat(value);
				if (isNaN(number)) {
					throw new HttpError(400, {
						error: 'invalid-request',
						message: `The parameter ${paramDesc.name} must be a valid number`
					});
				}

				return number;
			}
		} else if (paramType === Boolean) {
			let originalFactory = factory;
			factory = ev => {
				let value = originalFactory(ev);
				if (value === void 0)
					return value;
				
				return !['', 'no', '0', 'false', 'off'].includes(`${value}`.toLowerCase());
			}
		} else if (paramType === Date) {
			let originalFactory = factory;
			factory = ev => {
				let value = originalFactory(ev);
				if (value === void 0)
					return value;
				
				let date = new Date(value);

				if (!date.getDate()) {
					throw new HttpError(400, {
						error: 'invalid-request',
						message: `The parameter ${paramDesc.name} must be a valid timestamp`
					});
				}
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
        readonly preMiddleware: any[],
		readonly postMiddleware: any[],
		readonly interceptors: Interceptor[],
        readonly parentGroup: string,
        readonly controllerType : Function,
        readonly routeTable : any[],
		readonly definition : RouteDefinition
	) {
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

		this.prepareMethodMetadata();
		this.prepareMiddleware();
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
			path: this.definition.path,
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
	}

	private _description : RouteDescription;

	public get description() {
		return this._description;
	}

	private prepareMiddleware() {
		
		// Load up the defined middleware for this route
		let route = this.definition;
		let middleware = [
			...(this.server.options?.preRouteMiddleware ?? []),
			...this.preMiddleware,
			...(route.options.middleware ?? []),
			...this.postMiddleware,
			...(this.server.options?.postRouteMiddleware ?? [])
		];

		// Ensure indexes are valid.

		let invalidIndex = middleware.findIndex(x => !x);
		if (invalidIndex >= 0)
			throw new Error(`Route '${route.path}' provided null middleware at position ${invalidIndex}`);

		// Prepare the middlewares (if they are DI middlewares, they get injected)

		this.middleware = middleware;
		this.resolvedMiddleware = middleware.map(x => prepareMiddleware(this.injector, x));

		// Automatically handle body parsing 

		let { paramTypes, paramAnnotations } = this._methodMetadata;
		
		let bodyAnnotation = paramAnnotations
			.map(annots => annots.find(x => x instanceof InputAnnotation && x.type === 'body') as InputAnnotation)
			.filter(x => x)
			[0]
		;
		let bodyIndex = paramAnnotations.findIndex(annots => annots.some(x => x === bodyAnnotation));
		if (bodyAnnotation) {
			// need to add bodyParser
			let paramType = paramTypes[bodyIndex];
			let bodyMiddleware;

			if (paramType === String) {
				bodyMiddleware = bodyParser.text({ type: () => true });
			} else if (paramType === Buffer) {
				bodyMiddleware = bodyParser.raw({ type: () => true });
			} else {
				bodyMiddleware = bodyParser.json({ type: () => true });
			}

			if (bodyMiddleware) {
				this.resolvedMiddleware.push(bodyMiddleware);
			}
		}
	}

	middleware : MiddlewareProvider[];
	resolvedMiddleware : ConnectMiddleware[];

	private prepareMethodMetadata() {
		let controller = this.controllerType;
		let route = this.definition;

		let returnType = Reflect.getMetadata("design:returntype", controller.prototype, route.method);
		let paramTypes = Reflect.getMetadata("design:paramtypes", controller.prototype, route.method);
		let paramNames = getParameterNames(controller.prototype[route.method]);

		// Construct a set of easily addressable path parameter descriptions (pathParameterMap)
		// that can be decorated with insights from reflection later.

		let pathParamMatches = Array.from(route.path.match(/:([A-Za-z0-9]+)/g) ?? []);
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
				(ev : WebEvent) => ev.request, 
				(ev : WebEvent) => ev.response
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

	private async execute(instance, event : WebEvent) {
		if (!instance) 
			throw new ArgumentNullError('instance');
		
		event.controller = instance;
		event.server = this.server;
		event.route = this;

		if (!instance[this.definition.method]) {
			throw new ArgumentError(
				'instance', 
				`Provided instance does not have an implementation ` 
				+ `for method ${this.definition.method}()`
			);
		}

		let route = this.definition;
		let controllerType = this.controllerType;

		// Middleware

		await event.context(async () => {
			for (let item of this.resolvedMiddleware) {
				try {
					await new Promise<void>((resolve, reject) => item(event.request, event.response, (err?: any) => err ? reject(err) : resolve()));
				} catch (e) {
					event.metadata['uncaughtError'] = e;
					this.server.handleError(
						e,
						event, 
						this, 
						`Middleware ${item.name || 'anonymous'}()`
					);
					this.server.reportRequest('finished', event, reportSource);
					return;
				}
			}
		});

		// Execute our function by resolving the parameter factories into a set of parameters to provide to the 
		// function.

		let resolvedParams: any[];
		let reportSource = `${controllerType.name}.${route.method}()`;

		try {
			resolvedParams = await Promise.all(this.parameters.map(x => x.resolve(event)));
		} catch (e) {
			event.metadata['uncaughtError'] = e;
			this.server.handleError(e, event, this, reportSource);
			this.server.reportRequest('finished', event, reportSource);
			return;
		}

		let displayableParams = resolvedParams
			.map(param => {
				if (typeof param === 'undefined')
					return 'undefined';
				
				try {
					return JSON.stringify(param);
				} catch (e) {
					return String(param);
				}
			})
			.map(param => ellipsize(this.server.options.longParameterThreshold ?? 100, param))
		;
		reportSource = `${controllerType.name}.${route.method}(${displayableParams.join(', ')})`;

		this.server.reportRequest('starting', event, reportSource);
		try { // To finally report request completion.

			let result;

			let interceptors = [
				...this.server.options.interceptors ?? [],
				...this.interceptors ?? [],
				...this.definition.options.interceptors ?? [],
			].reverse();

			try {
				result = await event.context(async () => {
					let action = (...params) => instance[route.method](...params);
					for (let interceptor of interceptors) {
						let inner = action;
						action = (...params) => interceptor(inner, ...params);
					}

					return await action(...resolvedParams);

				});
			} catch (e) {
				event.metadata['uncaughtError'] = e;
				this.server.handleError(e, event, this, reportSource);
				return;
			}

			// Return value handling

			if (result === undefined) {
				if (!event.response.headersSent && event.response.statusCode === 200)
					event.response.statusCode = 204;
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

					event.response.statusCode = response.status;
					response.headers.forEach(x => event.response.setHeader(x[0], x[1]));
					
					if (response.encoding === 'raw') {
						if (response.body instanceof Buffer) {
							event.response.write(response.body);
						} else if (typeof response.body === 'string') {
							event.response.write(Buffer.from(response.body)); 
						} else if (response.body === undefined || response.body === null) {
							if (!event.response.headersSent && event.response.statusCode === 200)
								event.response.statusCode = 204;
						} else {
							throw new Error(`Unknown response body type ${response.body}`);
						}

						event.response.end();
					} else if (response.encoding === 'json') {
						if (response.unencodedBody)
							this.server.engine.sendJsonBody(event, response.unencodedBody);
						else
							event.response.end();

					} else {
						throw new Error(`Unknown encoding type ${response.encoding}`);
					}

				} else {
					// event.response
					// 	.status(200)
					// 	.send(result)
					// ;

					event.response.statusCode = 200;
					this.server.engine.sendJsonBody(event, result);
				}
			} catch (e) {
				console.error(`Caught exception:`);
				console.error(e);

				throw e;
			}
		} finally {
			this.server.reportRequest('finished', event, reportSource);
		}
	}

	/**
	 * Installs this route into the given web server application. 
	 * @param app 
	 */
	mount(pathPrefix : string) {
		this.description.pathPrefix = pathPrefix;

		this.server.addRoute(
			this.description,
			this.definition.httpMethod, 
			`${pathPrefix || ''}${this.definition.path}`,
			async ev => {
				// SECURITY-SENSITIVE: Prevent denial-of-service by exploiting a fault within Alterior's request handling.
				// Return a 500 error to the client and log.

				try {
					return await this.execute(this.controllerInstance, ev);
				} catch (e) {
					this.server.logger.fatal(`Alterior failed to process request ${ev.request.method} ${ev.request.url}: ${e.stack || e.message || e}`);
					this.server.logger.fatal(`The above error was caught using Alterior's last-chance error handler. This is always a bug. Please report this issue.`);
					
					ev.metadata['uncaughtError'] = e;
					this.server.handleError(
						e,
						ev, 
						this,
						`Last-chance error handler (Alterior bug)`
					);
					this.server.reportRequest('finished', ev, `Last-chance error handler (Alterior bug)`);
				}
			},
			[]
		);
	}
}