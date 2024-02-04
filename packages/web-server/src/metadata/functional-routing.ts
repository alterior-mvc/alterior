import { Constructor } from "@alterior/runtime";
import { MountDefinition } from "./mount-definition";
import { MountOptions } from "./mount-options";
import { inject } from "@alterior/di";
import { RouteOptions } from "./route-options";
import { RouteDefinition } from "./route-definition";
import { MOUNT_DEFINITION, ROUTE_DEFINITION } from "./functional-routing-private";

/**
 * Used to mount one controller onto another one. For instance, to mount controller B within controller A,
 * one can write:
 * 
 * ```typescript
 * class A {
 *     readonly b = mount(A, '/a');
 * }
 * ```
 * 
 * @param controller 
 * @param path 
 * @param options 
 * @returns 
 */
export function mount<T>(controller: Constructor<T>, path?: string, options: MountOptions = {}) {
	let defn: Omit<MountDefinition, 'propertyKey'> = { controller, path, options };
	return new Proxy(inject(controller) as object, {
		has(target, p) {
			if (p === MOUNT_DEFINITION)
				return true;
			return p in target;
		},
		get(target, p, receiver) {
			if (p === MOUNT_DEFINITION) {
				return defn;
			}
			return (target as any)[p];
		},
	})
}

export function route<T extends Function>(httpMethod: string, path: string, options: RouteOptions = {}, impl: T): T {
	let defn: Omit<RouteDefinition, 'method'> = { httpMethod, path, options };

	return new Proxy(impl, {
		has(target, p) {
			if (p === ROUTE_DEFINITION)
				return true;
			return p in target;
		},
		get(target, p, receiver) {
			if (p === ROUTE_DEFINITION) {
				return defn;
			}
			return (target as any)[p];
		},
	});
}
