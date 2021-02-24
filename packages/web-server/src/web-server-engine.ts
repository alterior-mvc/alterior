import { Provider } from "@alterior/di";
import { RouteEvent } from "./metadata";
import * as http from "http";
import { WebServerOptions } from './web-server-options';

export abstract class WebServerEngine {
	readonly app : any;
	readonly providers : Provider[];
	abstract addConnectMiddleware(path : string, middleware : Function);
	abstract addRoute(method : string, path : string, handler : (event : RouteEvent) => void, middleware?);
	abstract listen(options : WebServerOptions) : Promise<http.Server>;
	abstract sendJsonBody(routeEvent : RouteEvent, body : any);
}
