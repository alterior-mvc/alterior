
export let controllerClasses = [];
export function Controller() {
	return function(target) {
		controllerClasses.push(target);
	}
}

export class ControllerBase {
	respondWith(member : Function) {
		var self = this;
		return function() {
			member.apply(self, arguments);
		}
	}
}

export class RouteReflector {
	constructor(type : Function) {
		this.routes = (type.prototype['slvr:routes'] || []).splice(0);
	}

	public routes : RouteDefinition[];
}

export interface RouteDefinition {
	method : string;
	httpMethod : string;
	options : RouteOptions;
	path : string;
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
		let routes = target['slvr:routes'] || [];

		routes.push(<RouteDefinition>{
			method: propertyKey,
			httpMethod: method || "GET", 
			options: options || {},
			path: path
		});

		target['slvr:routes'] = routes;
	};
}