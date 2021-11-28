import { Provider } from "@alterior/di";
import { WebEvent } from "./metadata";
import * as http from "http";
import { WebServerOptions } from './web-server-options';
import { Constructor } from "@alterior/runtime";

export abstract class WebServerEngine {
	readonly app : (req : http.IncomingMessage, res : http.ServerResponse, next? : () => void) => void;
	readonly providers : Provider[];
	abstract addConnectMiddleware(path : string, middleware : Function);
	abstract addRoute(method : string, path : string, handler : (event : WebEvent) => void, middleware?);
	abstract addAnyRoute(handler : (event : WebEvent) => void);
	abstract listen(options : WebServerOptions) : Promise<http.Server>;
	abstract sendJsonBody(routeEvent : WebEvent, body : any);

	static default : Constructor<WebServerEngine> = null;
}
