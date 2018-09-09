/// <reference path="../../node_modules/reflect-metadata/index.d.ts" />

import * as express from 'express';
import { shallowClone, clone } from '@alterior/common';
import { Provider } from 'injection-js';

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
			mount.path = `${basePath}/${mount.path.replace(/^\/*/, '')}`
			if (!mount.controllers)
				mount.controllers = [];

			if (mount.options && mount.options.controllers)
				mount.controllers.push(...mount.options.controllers);
		});
	}

	public routes : RouteDefinition[];
	public mounts : MountDefinition[];
}

export interface MountDefinition {
	path : string;
	controllers : Function[];
	options : MountOptions;
	
	propertyKey? : string;
}

export interface MountOptions {
	providers? : Provider[];
	controllers? : Function[];
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
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		let routes = target['alterior:routes'] || [];

		routes.push(<RouteDefinition>{
			method: propertyKey,
			httpMethod: method || "GET", 
			options: options || {},
			path: path || ''
		});

		target['alterior:routes'] = routes;
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