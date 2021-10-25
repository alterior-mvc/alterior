import { shallowClone } from '@alterior/common';
import { Provider } from '@alterior/di';
import { Expose } from '@alterior/runtime';

export class RouteReflector {
	constructor(type : Function, mountPath? : string) {

		let controllerMetadata = Reflect.getMetadata("alterior:Controller", type);
		let basePath = '/' + (mountPath || '').replace(/^\/+|\/+$/g, '');

		if (basePath === '/')
			basePath = '';
		
		if (controllerMetadata && controllerMetadata.basePath) {
			let controllerBasePath = controllerMetadata.basePath.replace(/^\/+|\/+$/g, '');
			if (controllerBasePath !== '') {
				basePath += `/${controllerBasePath}`;
			}
		}

		if (basePath === '/')
			basePath = '';
		
		this.routes = (type.prototype['alterior:routes'] || []).map(x => shallowClone(x));
		this.routes.forEach(route => {
			route.path = `${basePath}/${route.path.replace(/^\/*/, '')}`.replace(/\/+$/g, '');
			if (route.path === '')
				route.path = '/';
		});

		this.mounts = (type.prototype['alterior:mounts'] || []).map(x => shallowClone(x));
		this.mounts.forEach(mount => {
			let definedMountPath = mount.path || '';
			mount.path = `${basePath}/${definedMountPath.replace(/^\/*/, '')}`
			mount.controller = Reflect.getMetadata('design:type', type.prototype, mount.propertyKey);
			if (!mount.controller) {
				throw new Error(
					`Failed to determine class for @Mount(${definedMountPath || ''}) in class ${type.name}. ` 
					+ `Make sure that emitDecoratorMetadata is enabled and the class is decorated. ` 
					+ `Make sure there are no circular dependencies. If the controller type is declared in ` 
					+ `the same file where @Mount() is make sure the controller is defined first.`
				);
			}
		});
	}

	public routes : RouteDefinition[];
	public mounts : MountDefinition[];
}

export interface MountDefinition {
	path : string;
	controller : Function;
	options : MountOptions;
	
	propertyKey? : string;
}

export interface MountOptions {
	providers? : Provider[];
}

export interface RouteDefinition {
	method : string;
	httpMethod : string;
	options : RouteOptions;
	path : string;
}

export interface RouteOptions {
	middleware?: Function[];
	description?: string;
	summary?: string;
	group?: string;
}

export function Get(path? : string, options? : RouteOptions) { return Route('GET', path, options); }
export function Put(path? : string, options? : RouteOptions) { return Route('PUT', path, options); }
export function Post(path? : string, options? : RouteOptions) { return Route('POST', path, options); }
export function Delete(path? : string, options? : RouteOptions) { return Route('DELETE', path, options); }
export function Options(path? : string, options? : RouteOptions) { return Route('OPTIONS', path, options); }
export function Patch(path? : string, options? : RouteOptions) { return Route('PATCH', path, options); }

export function Route(method : string, path? : string, options? : RouteOptions) {
    return function (target: Object, propertyKey: string, descriptor: PropertyDescriptor) {

		Expose()(target, propertyKey, descriptor);

		if (!target.hasOwnProperty('alterior:routes')) {
			Object.defineProperty(target, 'alterior:routes', {
				enumerable: false,
				value: []
			});
		}

		target['alterior:routes'].push(<RouteDefinition>{
			method: propertyKey,
			httpMethod: method || "GET", 
			options: options || {},
			path: path || ''
		});
	};
}

export function Mount(path? : string, options? : MountOptions) {
    return function (target: any, propertyKey: string) {
		let mounts = target['alterior:mounts'] || [];

		mounts.push(<MountDefinition>{
			path: path,
			options: options,
			propertyKey
		});

		target['alterior:mounts'] = mounts;
	};
}