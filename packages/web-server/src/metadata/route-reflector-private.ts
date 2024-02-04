import { shallowClone } from "@alterior/common";
import { RouteDefinition } from "./route-definition";
import { MountDefinition } from "./mount-definition";
import { MOUNT_DEFINITION, ROUTE_DEFINITION, isMountedController, isRouteFunction } from "./functional-routing-private";

/**
 * Used to introspect the routes and mounts that are defined on a specific controller instance. This is used
 * during the WebService bootstrapping process.
 * 
 * @internal
 */
export class RouteReflector {
	constructor(instance: any, mountPath?: string) {
		let type = instance.constructor;

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

		this.routes = this.getRoutesForInstance(instance).map(x => shallowClone(x));
		this.routes.forEach(route => {
			route.path = `${basePath}/${route.path.replace(/^\/*/, '')}`.replace(/\/+$/g, '');
			if (route.path === '')
				route.path = '/';
		});

		this.mounts = this.getMountsForInstance(instance).map(x => shallowClone(x));
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

	private getRoutesForInstance(instance: object) {
		let type = instance.constructor;
		let routes: RouteDefinition[] = [...(type.prototype['alterior:routes'] || [])];

		for (let [key, value] of Object.entries(instance)) {
			if (typeof value !== 'function')
				continue;

			if (isRouteFunction(value)) {
				routes.push({
					...value[ROUTE_DEFINITION],
					method: key
				})
			}
		}

		return routes;
	}

	private getMountsForInstance(instance: object) {
		let type = instance.constructor;
		let mounts: MountDefinition[] = [...(type.prototype['alterior:mounts'] || [])];

		for (let [key, value] of Object.entries(instance)) {
			if (typeof value !== 'object')
				continue;

			if (isMountedController(value)) {
				mounts.push({
					...value[MOUNT_DEFINITION],
					propertyKey: key
				})
			}
		}

		return mounts;
	}

	public routes: RouteDefinition[];
	public mounts: MountDefinition[];
}
