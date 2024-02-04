import { RouteOptions } from "./route-options";

export interface RouteDefinition {
	method: string;
	httpMethod: string;
	options: RouteOptions;
	path: string;
}