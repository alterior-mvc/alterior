import { RouteDescription } from "./route-description";

export interface ServiceDescription {
	name?: string;
	description?: string;
	version?: string;
	routes: RouteDescription[];
}
