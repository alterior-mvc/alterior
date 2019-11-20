import { RouteDescription } from "./route";

export interface ServiceDescription {
	name? : string;
	description? : string;
	version? : string;
	routes? : RouteDescription[];
}
