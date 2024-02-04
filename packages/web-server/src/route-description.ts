import { RouteDefinition } from "./metadata";
import { RouteParamDescription } from "./route-param-description";

export interface RouteDescription {
	definition: RouteDefinition;

	httpMethod: string;
	method: string;
	path: string;
	pathPrefix?: string;
	group?: string;

	description?: string;
	parameters: RouteParamDescription[];
}
