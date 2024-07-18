import { Annotation, MetadataName } from "@alterior/annotations";
import { ConcreteType, InjectionToken, inject, injectMultiple, provide } from "@alterior/di";
import { Logger, LoggingModule } from '@alterior/logging';
import { Application, ApplicationOptions, ApplicationRoles, BuiltinLifecycleEvents, Module, ModuleOptions } from "@alterior/runtime";
import { ControllerInstance } from './controller';
import { Controller } from "./metadata";
import { WebServer } from './web-server';
import { WEB_SERVER_OPTIONS, WebServerOptions, provideWebServerOptions } from "./web-server-options";

import * as conduit from '@astronautlabs/conduit';

const WEB_SERVICE = new InjectionToken<ConcreteType<any>>('WEB_SERVICE');

/**
 * Options for the web service. Available options are a superset 
 * of the options available for @Module() as well as WebServerModule.configure(...).
 */
export interface WebServiceOptions extends ApplicationOptions, ModuleOptions {
	/**
	 * Identity to use when exposing this service via Conduit. When not specified, the name of the class is used.
	 */
	identity?: string;

    /**
     * Human readable description of this web service, used for Conduit discovery and introspection as well 
     * as OpenAPI/Swagger definitions.
     */
    description?: string;

    /**
     * Whether this service is discoverable via Conduit. Defaults to true.
     */
    discoverable?: boolean;

    /**
     * Whether this service is introspectable via Conduit. Defaults to true.
     */
    introspectable?: boolean;

    server?: WebServerOptions;
}

@Module({
    imports: [LoggingModule]
})
class WebServerModule {
    private app = inject(Application);
    private rolesService = inject(ApplicationRoles);
    private logger = inject(Logger);
    private webServerOptions = inject(WEB_SERVER_OPTIONS, { optional: true }) ?? {};
    private webServiceClasses = injectMultiple(WEB_SERVICE);

    async [Module.onInit]() {
        let webserver: WebServer;

        webserver = new WebServer(
            this.app.runtime.injector,
            this.webServerOptions ?? {},
            this.logger,
            this.app.options
        );

        // Prepare the web service classes and mount them into the web server 

        let serviceInstances: ControllerInstance[] = [];

        for (let webServiceClass of this.webServiceClasses) {
            let serviceInstance = new ControllerInstance(
                webserver,
                webServiceClass,
                webserver.injector,
                [],
                '',
                true
            );
    
            serviceInstances.push(serviceInstance);
            await serviceInstance.initialize();
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
        }

        this.rolesService.registerRole({
            identifier: 'web-server',
            name: 'Web Server',
            summary: 'Starts a web server backed by the controllers configured in the module tree',
            start: async () => {
                await webserver.start();
                for (let serviceInstance of serviceInstances) {
                    await serviceInstance.start();
                    await serviceInstance.listen(webserver);
                }
            },
            stop: async () => {
                for (let serviceInstance of serviceInstances) {
                    await webserver.stop();
                    await serviceInstance.stop();
                }
            }
        })
    }
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

/**
 * Used to decorate a class which represents a REST service.
 * Such a class is both an Alterior module and an Alterior controller, meaning it 
 * can both act as the entry module of an Alterior application as well as define
 * REST routes using the `@Get()`/`@Post()`/etc decorators.
 */
export const WebService = Object.assign(
    <T> (options: WebServiceOptions = {}) => {
        return (target: ConcreteType<T>) => {

            // Apply Conduit metadata

            conduit.Name(options?.identity ?? target.name)(target);
            if (options?.description)
                conduit.Description(options.description)(target);
            conduit.Discoverable(options?.discoverable ?? true)(target);
            conduit.Introspectable(options?.introspectable ?? true)(target);
    
            Controller('', { group: 'service' })(target);

            options.providers ??= [];
            if (options.server)
                options.providers.push(provideWebServerOptions(options));

            // Apply module metadata

            Module(<Required<ModuleOptions>>{
                imports: [ 
                    ...(options?.imports ?? []),
                    WebServerModule
                ],
                prepare: options.prepare,
                providers: [
                    ...(options.providers ?? []),
                    provide(WEB_SERVICE, { multi: true }).usingValue(target)
                ],
                tasks: options.tasks
            })(target);

            // Apply WebServiceAnnotation

            new WebServiceAnnotation(options).applyToClass(target);
        };
    },
    BuiltinLifecycleEvents,

);

export class RestClientError extends Error {
    constructor(message: string, readonly response: Response) {
        super(message);
    }
}
