import { Annotation } from "@alterior/annotations/src/annotations";
import { MetadataName } from "@alterior/annotations";
import { ModuleOptions, Module } from "@alterior/di";
import { WebServerModule } from "web-server.module";
import { WebServerOptions } from "web-server";

export interface WebServiceOptions extends ModuleOptions, WebServerOptions {

}

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
export const Service = WebServiceAnnotation.decorator({
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
            options.imports.push(WebServerModule.configure(options));

        Module(options)(site.target);
        return new WebServiceAnnotation(options);
    }
});
