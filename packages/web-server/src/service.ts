import { Annotation } from "@alterior/annotations";
import { MetadataName } from "@alterior/annotations";
import { ModuleOptions, Module } from "@alterior/di";
import { WebServerModule } from "./web-server.module";
import { WebServerOptions } from "./web-server";
import { ApplicationOptions, AppOptions } from "@alterior/runtime";
import { Controller } from "./metadata";

/**
 * Options for the web service. Available options are a superset 
 * of the options available for @Module() as well as WebServerModule.configure(...).
 */
export interface WebServiceOptions extends ApplicationOptions, ModuleOptions {
    server : WebServerOptions;
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
 * Used to decorate a class which represents a minimal boilerplate REST service.
 * Such a class is both an Alterior module and an Alterior controller, meaning it 
 * can both act as the entry module of an Alterior application as well as define
 * REST routes using the @alterior/web-server @Get()/@Post()/etc decorators.
 */
export const WebService = WebServiceAnnotation.decorator({
    validTargets: [ 'class' ],
    factory: (site, options) => {
        options = Object.assign({}, options);

        if (!options.controllers)
            options.controllers = [];
        if (!options.imports)
            options.imports = [];

        options.controllers.push(site.target);

        let existingModule = options.imports.find(x => x === WebServerModule || x['$module'] === WebServerModule);

        if (!existingModule)
            options.imports.push(WebServerModule.configure(options.server));

        Module(options)(site.target);
        Controller('', { group: 'service' })(site.target);
        AppOptions(options)(site.target);
        
        return new WebServiceAnnotation(options);
    }
});
