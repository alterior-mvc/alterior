import { Annotation, MetadataName } from '@alterior/annotations';
import { disallowNativeAsync } from '@alterior/common';
import { MountDefinition } from './mount-definition';
import { MountOptions } from './mount-options';
import { Public } from './public';
import { RouteDefinition } from './route-definition';
import { RouteOptions } from './route-options';

/**
 * @group Decorators
 */
export function Get(path?: string, options?: RouteOptions) { return Route('GET', path, options); }

/**
 * @group Decorators
 */
export function Put(path?: string, options?: RouteOptions) { return Route('PUT', path, options); }

/**
 * @group Decorators
 */
export function Post(path?: string, options?: RouteOptions) { return Route('POST', path, options); }

/**
 * @group Decorators
 */
export function Delete(path?: string, options?: RouteOptions) { return Route('DELETE', path, options); }

/**
 * @group Decorators
 */
export function Options(path?: string, options?: RouteOptions) { return Route('OPTIONS', path, options); }

/**
 * @group Decorators
 */
export function Patch(path?: string, options?: RouteOptions) { return Route('PATCH', path, options); }

@MetadataName('alterior:route')
export class RouteAnnotation extends Annotation {
	constructor(
		readonly method: string, 
		readonly path?: string, 
		readonly options?: RouteOptions
	) {
		super();
	}
}

/**
 * @group Decorators
 */
export const Route = RouteAnnotation.decorator({
	validTargets: ['method'],
	factory: (site, method, path, options) => {
		const { target, propertyKey } = site;
		disallowNativeAsync((target as any)[propertyKey!]);

		Public(options)(target, propertyKey!);

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

/**
 * @group Decorators
 */
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
