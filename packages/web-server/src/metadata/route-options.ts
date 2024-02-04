import { MiddlewareDefinition } from "./controller";

export interface RouteOptions {
	middleware?: MiddlewareDefinition[];
	description?: string;
	summary?: string;
	group?: string;
}
