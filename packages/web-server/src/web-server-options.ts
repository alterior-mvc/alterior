import { WebEvent } from "./metadata";
import { RouteInstance } from "./route";

export interface WebServerOptions {
	port? : number;
	engine? : any;
    middleware? : Function[];
    hideExceptions? : boolean;
    verbose? : boolean;
	silent? : boolean;
	silentErrors? : boolean;
	onError? : (error : any, event : WebEvent, route : RouteInstance, source : string) => void;
	handleError? : (error : any, event : WebEvent, route : RouteInstance, source : string) => void;
}