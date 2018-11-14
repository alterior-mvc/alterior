import { Module, Injectable, Optional } from "@alterior/di";
import { OnInit, Application } from "@alterior/runtime";
import { ExpressRef } from "./express-ref";
import { WebServer, WebServerOptions } from "./web-server";
import { ControllerRegistrar } from "./controller";

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
})
export class WebServerModule implements OnInit {
    constructor(
        private app : Application,
        @Optional() private _options : WebServerOptionsRef,
        private expressRef : ExpressRef
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
                ExpressRef,
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
        this.webserver = new WebServer(this.app.runtime.injector, this.options, this.app.options);
        new ControllerRegistrar(this.webserver).register(this.controllers);

        this.expressRef.application = this.webserver.express;
    }

    altOnStart() {
        this.webserver.start();
    }

    altOnStop() {
        this.webserver.stop();
    }
}