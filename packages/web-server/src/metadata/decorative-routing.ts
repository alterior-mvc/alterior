import { disallowNativeAsync } from '@alterior/common';
import { Expose } from '@alterior/runtime';
import { RouteOptions } from './route-options';
import { RouteDefinition } from './route-definition';
import { MountOptions } from './mount-options';
import { MountDefinition } from './mount-definition';

export function Get(path?: string, options?: RouteOptions) { return Route('GET', path, options); }
export function Put(path?: string, options?: RouteOptions) { return Route('PUT', path, options); }
export function Post(path?: string, options?: RouteOptions) { return Route('POST', path, options); }
export function Delete(path?: string, options?: RouteOptions) { return Route('DELETE', path, options); }
export function Options(path?: string, options?: RouteOptions) { return Route('OPTIONS', path, options); }
export function Patch(path?: string, options?: RouteOptions) { return Route('PATCH', path, options); }

export function Route(method: string, path?: string, options?: RouteOptions) {
	return function (target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
		disallowNativeAsync((target as any)[propertyKey]);

		Expose()(target, propertyKey, descriptor);

		if (!target.hasOwnProperty('alterior:routes')) {
			Object.defineProperty(target, 'alterior:routes', {
				enumerable: false,
				value: []
			});
		}

		(target as any)['alterior:routes'].push(<RouteDefinition>{
			method: propertyKey,
			httpMethod: method || "GET",
			options: options || {},
			path: path || ''
		});
	};
}

export function Mount(path?: string, options?: MountOptions) {
	return function (target: any, propertyKey: string): void {
		let mounts = target['alterior:mounts'] || [];

		mounts.push(<MountDefinition>{
			path: path,
			options: options,
			propertyKey
		});

		target['alterior:mounts'] = mounts;
	};
}
