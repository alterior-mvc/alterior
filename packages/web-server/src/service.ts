import { Annotation, MetadataName } from "@alterior/annotations";
import { Module, ModuleOptions } from "@alterior/di";
import { Logger, LoggingModule } from '@alterior/logging';
import { AppOptions, Application, ApplicationOptions, RolesService } from "@alterior/runtime";
import { ControllerInstance } from './controller';
import { Controller } from "./metadata";
import { WebServer } from './web-server';
import { WebServerOptions } from "./web-server-options";

export type RestClient<T> = {
    [P in keyof T as T[P] extends ((...args: any[]) => any) ? P : never]:
    T[P] extends ((...args: any[]) => any)
    ? (...args: Parameters<T[P]>) => (
        ReturnType<T[P]> extends Promise<any>
        ? ReturnType<T[P]>
        : Promise<ReturnType<T[P]>>
    )
    : never
    ;
};

export interface ClientOptions { }

export interface RestClientConstructor<T> {
    new(endpoint: string, options?: ClientOptions): T;
}

/**
 * Options for the web service. Available options are a superset 
 * of the options available for @Module() as well as WebServerModule.configure(...).
 */
export interface WebServiceOptions extends ApplicationOptions, ModuleOptions {
    server?: WebServerOptions;
}

/**
 * Backing annotation for the @WebService() decorator which is a simple API
 * for constructing a web service using Alterior.
 */
@MetadataName('@alterior/web-server:WebService')
export class WebServiceAnnotation extends Annotation {
    constructor(options?: WebServiceOptions) {
        super();
    }
}

export interface WebServiceDecorator {
    (options?: WebServiceOptions): (target: any, ...args: any[]) => void;
}

/**
 * Used to decorate a class which represents a REST service.
 * Such a class is both an Alterior module and an Alterior controller, meaning it 
 * can both act as the entry module of an Alterior application as well as define
 * REST routes using the @alterior/web-server @Get()/@Post()/etc decorators.
 */
export const WebService = WebServiceAnnotation.decorator({
    validTargets: ['class'],
    factory: (site, options?: WebServiceOptions) => {
        @Module({
            imports: [LoggingModule]
        })
        class WebServerModule {
            constructor(
                private app: Application,
                private rolesService: RolesService,
                private logger: Logger
            ) {
            }

            altOnInit() {
                let webserver: WebServer;

                webserver = new WebServer(
                    this.app.runtime.injector,
                    options?.server ?? {},
                    this.logger,
                    this.app.options
                );

                let serviceInstance = new ControllerInstance(
                    webserver,
                    site.target,
                    webserver.injector,
                    [],
                    '',
                    true
                );

                serviceInstance.initialize();
                serviceInstance.mount(webserver);

                if (webserver.options.defaultHandler !== null) {
                    webserver.engine.addAnyRoute(ev => {
                        if (webserver.options.defaultHandler) {
                            webserver.options.defaultHandler(ev);
                            return;
                        }

                        ev.response.statusCode = 404;
                        ev.response.setHeader('Content-Type', 'application/json; charset=utf-8');
                        ev.response.write(JSON.stringify({ error: 'not-found' }));
                        ev.response.end();
                    });
                }

                this.rolesService.registerRole({
                    identifier: 'web-server',
                    instance: this,
                    name: 'Web Server',
                    summary: 'Starts a web server backed by the controllers configured in the module tree',
                    start: async () => {
                        await webserver.start();
                        serviceInstance.start();
                        serviceInstance.listen(webserver);
                    },
                    stop: async () => {
                        webserver.stop();
                        serviceInstance.stop();
                    }
                })
            }
        }

        options = Object.assign({}, options);

        if (!options.imports)
            options.imports = [];

        options.imports.push(WebServerModule);
        Controller('', { group: 'service' })(site.target);
        Module(options)(site.target);
        AppOptions(options)(site.target);

        return new WebServiceAnnotation(options);
    }
});

export class RestClientError extends Error {
    constructor(message: string, readonly response: Response) {
        super(message);
    }
}