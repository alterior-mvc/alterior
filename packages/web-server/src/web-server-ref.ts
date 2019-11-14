import { WebServer } from "web-server";
import { Injectable } from "@alterior/di";

@Injectable()
export class WebServerRef {
	server : WebServer;
}
