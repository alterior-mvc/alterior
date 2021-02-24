import { Annotation } from "@alterior/annotations";
import { MetadataName } from "@alterior/annotations";
import { ModuleOptions, Module, Optional, ReflectiveInjector } from "@alterior/di";
import { WebServerOptions } from "./web-server-options";
import { ApplicationOptions, AppOptions, Application, RolesService, Service } from "@alterior/runtime";
import { Controller } from "./metadata";
import { WebServiceCompiler } from './web-service-compiler';
import { Logger, LoggingModule } from '@alterior/logging';
import { WebServer } from './web-server';
import { ControllerInstance } from './controller';
import { ExpressEngine } from './express-engine';

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

/**
 * Used to decorate a class which represents a REST service.
 * Such a class is both an Alterior module and an Alterior controller, meaning it 
 * can both act as the entry module of an Alterior application as well as define
 * REST routes using the @alterior/web-server @Get()/@Post()/etc decorators.
 */
export const WebService = WebServiceAnnotation.decorator({
    validTargets: [ 'class' ],
    factory: (site, options : WebServiceOptions) => {
        @Module({
            imports: [ LoggingModule ],
            providers: [ ExpressEngine ]
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
                
                this.rolesService.registerRole({
                    identifier: 'web-server',
                    instance: this,
                    name: 'Web Server',
                    summary: 'Starts a web server backed by the controllers configured in the module tree',
                    start: async () => {
                        webserver.start();
                        serviceInstance.start();
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
