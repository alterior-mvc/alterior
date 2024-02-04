import { MountDefinition } from "./mount-definition";
import { RouteDefinition } from "./route-definition";

export const MOUNT_DEFINITION = Symbol();
export const ROUTE_DEFINITION = Symbol();

interface MountedController {
	[MOUNT_DEFINITION]: Omit<MountDefinition, 'propertyKey'>;
}

type RouteFunction = Function & {
	[ROUTE_DEFINITION]: Omit<RouteDefinition, 'method'>;
};

export function isMountedController(instance: object): instance is MountedController {
	return MOUNT_DEFINITION in instance;
}

export function isRouteFunction(func: Function): func is RouteFunction {
	return MOUNT_DEFINITION in func;
}