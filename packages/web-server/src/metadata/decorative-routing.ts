import { Annotation } from '@alterior/annotations';
import { disallowNativeAsync } from '@alterior/common';
import { MountDefinition } from './mount-definition';
import { MountOptions } from './mount-options';
import { Public } from './public';
import { RouteDefinition } from './route-definition';
import { RouteOptions } from './route-options';

export function Get(path?: string, options?: RouteOptions) { return Route('GET', path, options); }
export function Put(path?: string, options?: RouteOptions) { return Route('PUT', path, options); }
export function Post(path?: string, options?: RouteOptions) { return Route('POST', path, options); }
export function Delete(path?: string, options?: RouteOptions) { return Route('DELETE', path, options); }
export function Options(path?: string, options?: RouteOptions) { return Route('OPTIONS', path, options); }
export function Patch(path?: string, options?: RouteOptions) { return Route('PATCH', path, options); }

export class RouteAnnotation extends Annotation {
	constructor(
		readonly method: string, 
		readonly path?: string, 
		readonly options?: RouteOptions
	) {
		super();
	}
}

export const Route = RouteAnnotation.decorator({
	factory: (site, method, path, options) => {
		const { target, propertyKey } = site.target;
		disallowNativeAsync((target as any)[propertyKey]);

		Public(options)(target, propertyKey);

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

		return new RouteAnnotation(method, path, options);
	}
});

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
