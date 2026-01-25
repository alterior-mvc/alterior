import { Provider, inject } from "@alterior/di";
import { WebEvent } from "./metadata";
import { WebServerOptions } from './web-server-options';
import { Constructor } from "@alterior/runtime";
import { LogSeverity, Logger } from "@alterior/logging";
import { CertificateGenerator } from "./certificate-generator";

import * as http from "http";
import * as https from "https";
import * as http2 from "http2";
import * as net from "net";
import * as tls from "tls";

export type ConnectMiddleware = (req: http.IncomingMessage | http2.Http2ServerRequest, res: http.ServerResponse | http2.Http2ServerResponse, next: (err?: any) => void) => void;
export type ConnectApplication = (req: http.IncomingMessage | http2.Http2ServerRequest, res: http.ServerResponse | http2.Http2ServerResponse, next?: (err?: any) => void) => void;

export abstract class WebServerEngine {
    protected logger = inject(Logger, { optional: true });

    readonly app: ConnectApplication;
    readonly providers: Provider[] = [];

    abstract addConnectMiddleware(path: string, middleware: ConnectMiddleware);
    abstract addRoute(method: string, path: string, handler: (event: WebEvent) => void, middleware?);
    abstract addAnyRoute(handler: (event: WebEvent) => void);

    readonly supportedMethods = [
        "checkout", "copy", "delete", "get", "head", "lock", "merge",
        "mkactivity", "mkcol", "move", "m-search", "notify", "options",
        "patch", "post", "purge", "put", "report", "search", "subscribe",
        "trace", "unlock", "unsubscribe",
    ];

    async listen(options: WebServerOptions) {
        let primaryServer: http.Server | http2.Http2Server;
        type Protocol = 'h2'
            | 'http/1.1'
            | 'http/1.0';

        let primaryProtocols: Protocol[];

        let isSecure = !!options.certificate || !!options.sniHandler;

        if (isSecure)
            primaryProtocols = ['h2', 'http/1.1', 'http/1.0'];
        else
            primaryProtocols = ['http/1.1', 'http/1.0'];

        if (options.protocols)
            primaryProtocols = options.protocols;

        if (primaryProtocols.includes('h2') && !isSecure) {
            this.log('info', `WebServer: Configured for HTTP2 but no certificates are provided. Generating self-signed certificates for testing...`);
            let generator = new CertificateGenerator();
            let certs = await generator.generate([
                {
                    name: 'commonName',
                    value: 'example.org'
                }, {
                    name: 'countryName',
                    value: 'US'
                }, {
                    shortName: 'ST',
                    value: 'Virginia'
                }, {
                    name: 'localityName',
                    value: 'Blacksburg'
                }, {
                    name: 'organizationName',
                    value: 'Test'
                }, {
                    shortName: 'OU',
                    value: 'Test'
                }
            ]);
            options.certificate = certs.cert;
            options.privateKey = certs.private;
            isSecure = true;
        }

        if (isSecure) {
            let tlsOptions: tls.TlsOptions = {};

            if (options.sniHandler) {
                tlsOptions.SNICallback = async (servername, callback) => {
                    try {
                        let context = await options.sniHandler(servername)
                        callback(undefined, context);
                    } catch (e) {
                        callback(e);
                    }
                };
            } else if (options.certificate) {
                tlsOptions.cert = options.certificate;
                tlsOptions.key = options.privateKey;
            }
            
            primaryServer = primaryProtocols.includes('h2')
                ? http2.createSecureServer(tlsOptions, this.app)
                : https.createServer(tlsOptions, this.app);
        } else {
            primaryServer = http.createServer(this.app);
        }

        this.log('info', `WebServer: Listening on port ${options.port}`);
        primaryServer.listen(options.port);

        this.attachWebSocketHandler(primaryServer);

        return primaryServer;
    }

    /**
     * When TLS is enabled, this is called when the user has configured a 
     * secondary listener for HTTP. If a secondary listener is configured and the 
     * plugin does not provide this method, the application will throw an exception.
     * @param options 
     */
    async listenInsecurely(options: WebServerOptions) {
        let server = http.createServer(this.app);
        this.attachWebSocketHandler(server);
        server.listen(options.insecurePort);
        return server;
    }

    sendJsonBody(routeEvent: WebEvent, body: any) {
        routeEvent.response.setHeader('Content-Type', 'application/json; charset=utf-8');
        routeEvent.response.write(JSON.stringify(body))
        // TODO: This is the more appropriate route, and would result in a 204 No Content,
        // but it is a behavior change.
        // if (body !== undefined)
        // 	routeEvent.response.write(JSON.stringify(body));
        routeEvent.response.end();
    }

    static default: Constructor<WebServerEngine> = null;

    protected log(severity: LogSeverity, message: string) {
        if (this.logger)
            this.logger.log(message, { severity });
        else if (severity === 'info')
            console.info(message);
        else if (severity === 'warning')
            console.warn(message);
        else if (severity === 'error' || severity === 'fatal')
            console.error(message);
        else if (severity === 'debug')
            console.debug(message);
        else
            console.log(message);
    }

    /**
     * Attach an `upgrade` handler to the HTTP server for the purposes of supporting
     * Alterior's seamless WebSocket support. 
     * @param server 
     */
    protected attachWebSocketHandler(server: http.Server | http2.Http2Server) {
        server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
            let res = new http.ServerResponse(req);
            req['__upgradeHead'] = head;
            res.assignSocket(req.socket);
            this.app(req, res);
        });
    }
}
