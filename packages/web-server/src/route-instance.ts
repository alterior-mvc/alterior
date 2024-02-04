import { Annotations } from "@alterior/annotations";
import { ArgumentError, ArgumentNullError, getParameterNames } from "@alterior/common";
import { Injector, Provider, ReflectiveInjector } from '@alterior/di';
import { InputAnnotation } from "./input";
import { RouteDefinition, RouteOptions, WebEvent } from "./metadata";
import { prepareMiddleware } from "./middleware";
import { Response } from './response';
import { ellipsize } from './utils';
import { WebServer } from "./web-server";
import { WebServerSetupError } from "./web-server-setup-error";

import * as bodyParser from 'body-parser';
import { RouteParamDescription } from "./route-param-description";
import { RouteMethodMetadata } from "./route-method-metadata";
import { RouteDescription } from "./route-description";
import { RouteMethodParameter } from "./route-method-parameter";

/**
 * Represents a Route instance
 */
export class RouteInstance {
	constructor(
		readonly server: WebServer,
		readonly controllerInstance: any,
		readonly injector: Injector,
		readonly parentMiddleware: any[],
		readonly parentGroup: string,
		readonly controllerType: Function,
		readonly routeTable: any[],
		readonly definition: RouteDefinition
	) {
		this.options = this.definition.options ?? {};
		this.group = this.options.group || this.parentGroup;
		this.middleware = [...(this.options.middleware ?? [])];

		this.routeTable.push({
			controller: this.controllerType,
			route: this.definition
		});

		let routeParams = (this.definition.path || "").match(/:([A-Za-z][A-Za-z0-9]*)/g) || [];
		this.params = routeParams.map(x => x.substr(1));

		// Construct a set of easily addressable path parameter descriptions (pathParameterMap)
		// that can be decorated with insights from reflection later.

		this.methodMetadata = {
			returnType: this.getMethodReflectedMetadata("design:returntype"),
			paramTypes: this.getMethodReflectedMetadata("design:paramtypes"),
			paramNames: getParameterNames(this.controllerType.prototype[this.definition.method]),
			pathParamNames: this.getPathParams(this.definition.path),
			paramAnnotations: Annotations.getParameterAnnotations(this.controllerType, this.definition.method, false)
		}

		this.prepareParameters();

		// Validate Middleware

		let invalidIndex = this.middleware.findIndex(x => !x);
		if (invalidIndex >= 0)
			throw new Error(`Route '${this.definition.path}' provided null middleware at position ${invalidIndex}`);

		// Prepare metadata

		this.description = {
			definition: this.definition,
			httpMethod: this.definition.httpMethod,
			group: this.group,
			method: this.definition.method,
			path: this.definition.path,
			parameters: this.methodMetadata.pathParamNames
				.map(id => <RouteParamDescription>{
					name: id.replace(/^:/, ''),
					type: 'path'
				})
				.map(desc => this.pathParameterMap[desc.name] = desc)
		};
	}

	readonly params: string[];
	readonly options: RouteOptions;
	readonly group: string;
	readonly methodMetadata: RouteMethodMetadata;

	private _pathParameterMap: Record<string, RouteParamDescription> = {};

	get pathParameterMap() {
		return this._pathParameterMap;
	}

	readonly description: RouteDescription;

	private prepareMiddleware() {
		// Procure an injector which can handle injecting the middlewares' providers

		let childInjector = ReflectiveInjector.resolveAndCreate(
			<Provider[]>this.middleware.filter(x => Reflect.getMetadata('alterior:middleware', x)),
			this.injector
		);

		// Prepare the middlewares (if they are DI middlewares, they get injected)
		let resolvedMiddleware = this.middleware.map(x => prepareMiddleware(childInjector, x));

		// Automatically handle body parsing 

		let { paramTypes, paramAnnotations } = this.methodMetadata;

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
				bodyMiddleware = bodyParser.text();
			} else if (paramType === Buffer) {
				bodyMiddleware = bodyParser.raw();
			} else {
				bodyMiddleware = bodyParser.json();
			}

			if (bodyMiddleware) {
				resolvedMiddleware.push(bodyMiddleware);
			}
		}

		return resolvedMiddleware;
	}

	middleware: any[];

	private getMethodReflectedMetadata<T = unknown>(name: string): T {
		return Reflect.getMetadata(name, this.controllerType.prototype, this.definition.method);
	}

	private getPathParams(path: string) {
		return Object.keys(
			Array.from(path.match(/:([A-Za-z0-9]+)/g) ?? [])
				.reduce((pv, cv) => (pv[cv] = 1, pv), <Record<string, number>>{})
		);
	}

	private prepareParameters() {
		let controller = this.controllerType;
		let route = this.definition;
		let sourceName = `${controller.name || controller}.${route.method}()`;
		let { returnType, paramTypes, paramNames, paramAnnotations } = this.methodMetadata;

		let paramFactories = [];
		//let pathParameterMap : any = {};

		if (!paramTypes) {
			paramFactories = [
				(ev: WebEvent) => ev.request,
				(ev: WebEvent) => ev.response
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

	_parameters: RouteMethodParameter[] = [];

	get parameters() {
		return this._parameters.slice();
	}

	private async execute(instance: any, event: WebEvent) {
		if (!instance)
			throw new ArgumentNullError('instance');

		event.controller = instance;
		event.server = this.server;

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

			try {
				result = await event.context(async () => {
					return await instance[route.method](...resolvedParams);
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
						this.server.engine.sendJsonBody(event, response.unencodedBody);
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
	 * Installs this route into the given Express application. 
	 * @param app 
	 */
	mount(pathPrefix: string) {
		this.description.pathPrefix = pathPrefix;

		this.server.addRoute(
			this.description,
			this.definition.httpMethod,
			`${pathPrefix || ''}${this.definition.path}`,
			ev => this.execute(this.controllerInstance, ev),
			this.prepareMiddleware()
		);
	}
}