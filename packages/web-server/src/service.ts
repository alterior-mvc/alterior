import { Annotation, MetadataName } from "@alterior/annotations";
import { InjectionToken, inject, injectMultiple, provide } from "@alterior/di";
import { Logger, LoggingModule } from '@alterior/logging';
import { Application, BuiltinLifecycleEvents, Constructor, Module, ModuleOptions, RolesService } from "@alterior/runtime";
import { ControllerInstance } from './controller';
import { CONST_HTTP_VERB_MAP, Controller, HTTP_VERBS, HTTP_VERB_MAP, Route, RouteOptions } from "./metadata";
import { WebServer } from './web-server';
import { WEB_SERVER_OPTIONS } from "./web-server-options";

import * as conduit from '@astronautlabs/conduit';
import { InputAnnotation } from "./input";

/**
 * Options for the web service. Available options are a superset 
 * of the options available for @Module() as well as WebServerModule.configure(...).
 */
export interface WebServiceOptions extends ModuleOptions {
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
}

@Module({
    imports: [LoggingModule]
})
class WebServerModule {
    private app = inject(Application);
    private rolesService = inject(RolesService);
    private logger = inject(Logger);
    private webServerOptions = inject(WEB_SERVER_OPTIONS);
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
            instance: this,
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
 * Used to decorate a class which represents a REST service.
 * Such a class is both an Alterior module and an Alterior controller, meaning it 
 * can both act as the entry module of an Alterior application as well as define
 * REST routes using the @alterior/web-server @Get()/@Post()/etc decorators.
 */
export const WebService = Object.assign(
    <T> (serviceClientConstructor: WebServiceClientConstructor<T>, options: WebServiceOptions = {}) => {
        return (target: Constructor<T>) => {

            // Apply Conduit metadata

            conduit.Name(options?.identity ?? target.name)(target);
            if (options?.description)
                conduit.Description(options.description)(target);
            conduit.Discoverable(options?.discoverable ?? true)(target);
            conduit.Introspectable(options?.introspectable ?? true)(target);
    
            Controller('', { group: 'service' })(target);

            // Apply module metadata

            Module(<Required<ModuleOptions>>{
                imports: [ 
                    ...(options?.imports ?? []),
                    WebServerModule
                ],
                prepare: options.prepare,
                providers: [
                    ...(options.providers ?? []),
                    provide(WEB_SERVICE, { multi: true }).usingClass(target)
                ],
                tasks: options.tasks
            })(target);

            // Apply WebServiceAnnotation

            new WebServiceAnnotation(serviceClientConstructor, options).applyToClass(target);
        };
    },
    BuiltinLifecycleEvents,
    {
        define: <T>(definer: (t: ReturnType<typeof WebServiceBuilder>) => T): WebServiceClientConstructor<T> => {
            let serviceInterface = definer(WebServiceBuilder());

            const constructor: WebServiceClientConstructor<T> = Object.assign(
                <any><() => WebServiceInterface<T>>(() => {
                    // TODO
                }),
                {
                    ['interface']: serviceInterface,
                    http(definer: (r: HttpDecorators<T>) => void) {
                        definer(
                            new Proxy<HttpDecorators<T>>({} as any, {
                                get: (_, p) => {
                                    if (typeof p === 'string' && Object.keys(HTTP_VERB_MAP).includes(p)) {
                                        return (path?: string, options?: RouteOptions): MethodDecorator => {
                                            return Route(HTTP_VERB_MAP[p], path, options);
                                        };
                                    }
                                }
                            })
                        );

                        return this;
                    }
                }
            );

            constructor.http

            return constructor;
        },
    }
);

export class RestClientError extends Error {
    constructor(message: string, readonly response: Response) {
        super(message);
    }
}

///////////////////////////////////////////////////////////////////

// PROBLEM: All of this loses the decorator metadata. We could force 
// the implementation method to have a decorator on it (would double for 
// ensuring the developer doesn't forget that the method is published),
// but the generated client would then not have this information at runtime.
// The client needs this information in order to create an HTTP request

const FooInterface = WebService
    .define(t => ({
        info: t.method<[thing: string], { description: string }>(
            t.documentation({
                summary: 'Provides information about the given thing'
            })
        )
    }))
    .http(r => [
        r.get('/:thing').bind((r, i) => i.info(r.path('thing')))
    ])
;

type FooInterface = typeof FooInterface.interface;

@WebService(FooInterface)
export class FooConcrete {
    async info(thing: string) {
        return { description: `That thing is named ${thing}` };
    }
}

let x = new FooInterface('blah');
let y: FooInterface;

y = x;


x.info(123);

