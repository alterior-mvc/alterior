import { Annotation, Annotations } from "@alterior/annotations";
import { MetadataName } from "@alterior/annotations";
import { ModuleOptions, Module } from "@alterior/di";
import { WebServerOptions } from "./web-server-options";
import { ApplicationOptions, AppOptions, Application, RolesService, Service, Constructor } from "@alterior/runtime";
import { Controller } from "./metadata";
import { WebServiceCompiler } from './web-service-compiler';
import { Logger, LoggingModule } from '@alterior/logging';
import { WebServer } from './web-server';
import { ControllerInstance } from './controller';
import { RouteDefinition } from './metadata/route';
import { InputAnnotation } from "./input";
import { getParameterNames } from "@alterior/common";

export type RestClient<T> = {
    [P in keyof T as T[P] extends ((...args) => any) ? P : never]: 
        T[P] extends ((...args) => any) 
            ? (...args : Parameters<T[P]>) => (
                ReturnType<T[P]> extends Promise<any> 
                    ? ReturnType<T[P]> 
                    : Promise<ReturnType<T[P]>>
            )
            : never
    ;
};

export interface ClientOptions { }

export interface RestClientConstructor<T> {
    new (endpoint : string, options? : ClientOptions) : T;
}

/**
 * Options for the web service. Available options are a superset 
 * of the options available for @Module() as well as WebServerModule.configure(...).
 */
export interface WebServiceOptions extends ApplicationOptions, ModuleOptions {
    server? : WebServerOptions;
}

/**
 * Backing annotation for the @WebService() decorator which is a simple API
 * for constructing a web service using Alterior.
 */
@MetadataName('@alterior/web-server:WebService')
export class WebServiceAnnotation extends Annotation {
    constructor(options? : WebServiceOptions) {
        super();
    }
}

export interface WebServiceDecorator {
    (options? : WebServiceOptions): (target : any, ...args: any[]) => void; 

    /**
     * (Experimental)
     * Produce a REST service client for the given web service class, 
     * which should be decorated with `@WebService` and 
     * conform to the Transparent Service expectations.
     * 
     * @param klass The transparent web service to create a client for
     * @param endpoint The endpoint where the service is hosted
     * @param options A set of options
     */
    clientFor<T>(klass : Constructor<T>, endpoint : string, options? : ClientOptions): RestClient<T>;

    /**
     * (Experimental)
     * Produce a class which can construct REST service clients for the 
     * given web service class, which should be decorated with `@WebService` and 
     * conform to the Transparent Service expectations.
     * 
     * @param klass 
     */
    clientClassFor<T>(klass : Constructor<T>): RestClientConstructor<RestClient<T>>;
}

/**
 * Used to decorate a class which represents a REST service.
 * Such a class is both an Alterior module and an Alterior controller, meaning it 
 * can both act as the entry module of an Alterior application as well as define
 * REST routes using the @alterior/web-server @Get()/@Post()/etc decorators.
 */
export const WebService : WebServiceDecorator = <any>WebServiceAnnotation.decorator({
    validTargets: [ 'class' ],
    factory: (site, options : WebServiceOptions) => {
        @Module({
            imports: [ LoggingModule ]
        })
        class WebServerModule {
            constructor(
                private app : Application,
                private rolesService : RolesService,
                private logger : Logger
            ) {
            }

            altOnInit() {
                let  webserver : WebServer;

                webserver = new WebServer(this.app.runtime.injector, options.server, this.logger, this.app.options);
                let allRoutes = [];
                let serviceInstance = new ControllerInstance(
                    webserver, 
                    site.target, 
                    webserver.injector, 
                    allRoutes, 
                    undefined, 
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
        Service({ compiler: WebServiceCompiler })(site.target);
        
        return new WebServiceAnnotation(options);
    }
});

export class RestClientError extends Error {
    constructor(message : string, readonly response : Response) {
        super(message);
    }
}

WebService.clientClassFor = function<T>(klass : Constructor<T>): RestClientConstructor<RestClient<T>> {
    function ctor(endpoint : string, options? : ClientOptions) {
        let routes : RouteDefinition[] = klass.prototype['alterior:routes'] || [];
        let routeMap = new Map<string, RouteDefinition>();
        for (let route of routes)
            routeMap.set(route.method, route);

        return new Proxy({}, {
            get(target, prop, receiver) {
                if (typeof prop === 'symbol' || typeof prop === 'number') 
                    return undefined; 
                let route = routeMap.get(prop);
                if (!route) 
                    return undefined;

                let fetchp : typeof fetch;

                if (typeof fetch !== 'undefined') {
                    fetchp = fetch;
                } else {
                    if (typeof require !== 'undefined') {
                        try {
                            fetchp = require('node-fetch');
                        } catch (e) {
                            console.error(`Failed to load node-fetch:`);
                            console.error(e);
                        }
                    }
                }

                if (!fetchp)
                    throw new Error(`No fetch() implementation available`);

                let returnType = Reflect.getMetadata('design:returntype', klass.prototype, route.method);
                let paramTypes = Reflect.getMetadata('design:paramtypes', klass.prototype, route.method);
                let paramNames : string[] = getParameterNames(klass.prototype[route.method]);
                let paramAnnotations = Annotations.getParameterAnnotations(klass, route.method, false);
        		let pathParamNames = Object.keys(
                    (route.path.match(/:([A-Za-z0-9]+)/g) || [])
                        .reduce((pv, cv) => (pv[cv] = 1, pv), {})
                );

                let paramFactories = paramNames.map((paramName, i) => {
                    let annots = paramAnnotations[i] || [];
                    let inputAnnot = <InputAnnotation>annots.find(x => x instanceof InputAnnotation);

                    return (request : RequestInit, path : Record<string,string>, query : Record<string,string>, value : any) => {
                        let isBody = false;

                        if (inputAnnot) {
                            if (inputAnnot.type === 'body') {
                                isBody = true;
                            } else if (inputAnnot.type === 'path') {
                                path[inputAnnot.name || paramName] = value;
                            } else if (inputAnnot.type === 'queryParam') {
                                query[inputAnnot.name || paramName] = value;
                            } else if (inputAnnot.type === 'queryParams') {
                                // TODO
                            }
                        } else {
                            if (paramName === 'body') {
                                isBody = true;
                            } else {
                                if (pathParamNames.includes(`:${paramName}`)) {
                                    path[paramName] = value;
                                }
                            }
                        }

                        if (isBody) {
                            request.headers['Content-Type'] = 'application/json';
                            request.body = JSON.stringify(value); // TODO: handle other body types
                        }
                    }
                });

                let pathVars = route.path.match(/:[^:/]/g);
                let pathChunks : string[] = [];
                let unconsumedPath = route.path;
                for (let pathVar of pathVars) {
                    let index = unconsumedPath.indexOf(pathVar);
                    let before = unconsumedPath.slice(0, index);

                    if (before)
                        pathChunks.push(before);
                       
                    pathChunks.push(pathVar);
                    unconsumedPath = unconsumedPath.slice(index + pathVar.length);
                }

                if (unconsumedPath)
                    pathChunks.push(unconsumedPath);

        		// Construct a set of easily addressable path parameter descriptions (pathParameterMap)
        		// that can be decorated with insights from reflection later.

                return async (...args : any[]) => {
                    let init : RequestInit = {
                        method: route.httpMethod,
                        headers: []
                    };
                    let path : Record<string,string> = {};
                    let query : Record<string,string> = {};

                    for (let i = 0, max = args.length; i < max; ++i)
                        paramFactories[i](init, path, query, args[i]);

                    let url = endpoint;

                    for (let chunk of pathChunks) {
                        url += chunk.startsWith(':') ? String(path[chunk.slice(1)] || '') : chunk;
                    }

                    let queryString = Object.keys(query)
                        .filter(k => query[k] !== undefined)
                        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
                        .join('&');

                    if (queryString !== '')
                        url = `${url}?${queryString}`;

                    let response = await fetchp(url, init);

                    if (response.status >= 400)
                        throw new RestClientError(`${response.status} ${response.statusText}`, response);
                    
                    // TODO: more exotic response body types
                    return await response.json();
                };
            }
        });
    }

    return <any>ctor;
};


WebService.clientFor = function<T>(klass : Constructor<T>, endpoint : string, options? : ClientOptions) {
    return new (WebService.clientClassFor(klass))(endpoint, options);
};