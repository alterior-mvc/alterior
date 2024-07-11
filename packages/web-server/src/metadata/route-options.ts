import { Interceptor } from "../web-server-options";
import { MiddlewareDefinition } from "./controller";
import { PublicOptions } from "./public";

export interface RouteOptions extends PublicOptions {
	middleware?: MiddlewareDefinition[];
	description?: string;
	/**
	 * Wrap execution of this method with the given interceptors. Earlier interceptors run first. 
	 * Technically this is the same as using a mutating decorator (see Mutator.create() from `@/annotations`)
	 * or using the `@Intercept()` helper decorator, but it is provided here for API symmetry.
	 */
	interceptors?: Interceptor[];
	summary?: string;
	group?: string;
}
