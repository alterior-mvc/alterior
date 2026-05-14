import middie from '@fastify/middie';
import fastify from "fastify";

import { inject } from "@alterior/di";
import {
    WebEvent, WebServerEngine, ConnectMiddleware, ServerOwnedWebEvent, WebServer, ConnectApplication,
    RequestBase, ResponseBase
} from '@alterior/web-server';

export class FastifyEngine extends WebServerEngine {
    private server = inject(WebServer);

    private setup() {
        let app = fastify();
        app.register(middie);
        return app;
    }
    readonly fastify = this.setup();
    readonly app: ConnectApplication = (req, res) => this.fastify.server.emit('request', req, res);
    readonly providers = [];

    override sendJsonBody(routeEvent: WebEvent, body: any) {
        routeEvent.response.setHeader('Content-Type', 'application/json');
        routeEvent.response.write(body);
        routeEvent.response.end();
    }

    override addConnectMiddleware(path: string, middleware: any) {
        this.fastify.use(path, middleware);
    }

    override addRoute(method: string, path: string, handler: (event: WebEvent) => void, middleware?: ConnectMiddleware[]) {
        if (!middleware)
            middleware = [];
        (this.fastify as any)[this.getRegistrarName(method)](
            path,
            ...middleware,
            (req: RequestBase, res: ResponseBase) => {
                return handler(new WebEvent(req, res));
            }
        );
    }

    override addAnyRoute(handler: (event: ServerOwnedWebEvent) => void) {
        this.fastify.all('*', (req, res) => handler(this.server.registerEvent(new WebEvent(req as any, res as any))));
    }

    private getRegistrarName(method: string) {
        let registrar = method.toLowerCase();
        if (!this.supportedMethods.includes(registrar))
            throw new Error(`The specified method '${method}' is not supported by Express.`);

        return registrar;
    }
}
