import { MiddlewareDefinition } from "./controller";
import { PublicOptions } from "./public";

export interface RouteOptions extends PublicOptions {
	middleware?: MiddlewareDefinition[];
	group?: string;
}
