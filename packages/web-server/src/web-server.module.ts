import { Module, Injectable, Optional } from "@alterior/di";
import { OnInit, Application, RolesService } from "@alterior/runtime";
import { ExpressRef } from "./express-ref";
import { WebServer, WebServerOptions } from "./web-server";
import { ControllerRegistrar } from "./controller";
import { LoggingModule, Logger } from "@alterior/logging";
import { WebServerRef } from "./web-server-ref";

@Injectable()
export class WebServerOptionsRef {
    constructor(options : WebServerOptions) {
        this.options = options;
    }

    public options : WebServerOptions;
}

/**
 * Import this into your application module to serve a REST service.
 * You must then specify controllers in the `controllers` field of 
 * one or more modules.
 */
@Module({
    imports: [
        LoggingModule
    ],
    providers: [
        ExpressRef, WebServerRef
    ]
})
export class WebServerModule implements OnInit {
    constructor(
        private app : Application,
        private rolesService : RolesService,
        private logger : Logger,

        @Optional() private _options : WebServerOptionsRef,
        private expressRef : ExpressRef,
        private webServerRef : WebServerRef
    ) {
    }

    /**
     * Used when importing this module from the root (app) module
     * using the default configuration.
     * Should be called only once in the application.
     */
    public static forRoot() {
        return this.configure({});
    }

    /**
     * Create a configured version of the WebServerModule that can 
     * be then be imported into a root module. Should be called only
     * once in the application.
     * 
     * @param options The options to use for the web server
     */
    public static configure(options : WebServerOptions) {
        return {
            $module: WebServerModule,
            providers: [
                { provide: WebServerOptionsRef, useValue: new WebServerOptionsRef(options) }
            ]
        }
    }

    webserver : WebServer;

    get options(): WebServerOptions {
        return this._options ? this._options.options : {} || {};
    }

    get controllers(): Function[] {
        return [].concat(...this.app.runtime.definitions.map(x => x.metadata.controllers || []));
    }

    altOnInit() {
        this.webserver = new WebServer(this.app.runtime.injector, this.options, this.logger, this.app.options);
        this.webServerRef.server = this.webserver;

        new ControllerRegistrar(this.webserver).register(this.controllers);

        this.expressRef.application = this.webserver.express;

        let self = this;

        this.rolesService.registerRole({
            identifier: 'web-server',
            instance: this,
            name: 'Web Server',
            summary: 'Starts a web server backed by the controllers configured in the module tree',
            async start() {
                self.webserver.start();
            },

            async stop() {
                self.webserver.stop();
            }
        })

    }
}