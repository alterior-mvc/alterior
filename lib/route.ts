import * as express from 'express';
import { clone } from './clone';

export class RouteReflector {
	constructor(type : Function) {

		let controllerMetadata = Reflect.getMetadata("alterior:Controller", type);
		let basePath = '';

		if (controllerMetadata.basePath) {
			basePath = controllerMetadata.basePath.replace(/^\/*/, '');
			basePath = basePath != '' ? `/${basePath}/` : basePath;
		}

		this.routes = (type.prototype['alterior:routes'] || []).map(x => clone(x));

		if (controllerMetadata.basePath) {
			this.routes.forEach(route => {
				route.path = basePath + route.path.replace(/^\/*/, '');
			})
		}
	}

	public routes : RouteDefinition[];
}

export interface RouteDefinition {
	method : string;
	httpMethod : string;
	options : RouteOptions;
	path : string;
}

export class RouteEvent {
	constructor(request : express.Request, response : express.Response) {
		this.request = request;
		this.response = response;
	}

	request : express.Request;
	response : express.Response;
}

export interface RouteOptions {
	middleware?: Function[];
}

export function Get(path : string, options? : RouteOptions) { return Route('GET', path, options); }
export function Put(path : string, options? : RouteOptions) { return Route('PUT', path, options); }
export function Post(path : string, options? : RouteOptions) { return Route('POST', path, options); }
export function Delete(path : string, options? : RouteOptions) { return Route('DELETE', path, options); }
export function Options(path : string, options? : RouteOptions) { return Route('OPTIONS', path, options); }
export function Patch(path : string, options? : RouteOptions) { return Route('PATCH', path, options); }

export function Route(method : string, path : string, options? : RouteOptions) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		let routes = target['alterior:routes'] || [];

		routes.push(<RouteDefinition>{
			method: propertyKey,
			httpMethod: method || "GET", 
			options: options || {},
			path: path
		});

		target['alterior:routes'] = routes;
	};
}