import { ExpressRef } from "./express-ref";
import { Application, RolesService, AppOptions, AppOptionsAnnotation } from "@alterior/runtime";
import * as supertest from 'supertest';
import { Module } from "@alterior/di";
import { WebServerModule, WebServerOptionsRef } from "./web-server.module";
import { WebServerOptions, ExpressEngine, WebServerEngine } from "./web-server";
import { RouteEvent } from "./metadata";
import { RouteInstance } from "./route";
import { Annotations } from "@alterior/annotations";
import { WebServerRef } from "./web-server-ref";
import { WebServiceAnnotation } from "service";

export function teststrap(module : Function, options? : WebServerOptions) {
    return supertest(async (req, res, next) => {

        let appOptionsAnnot = AppOptionsAnnotation.getForClass(module);

        @AppOptions(appOptionsAnnot ? appOptionsAnnot.options : {})
        @Module({
            imports: [
                module
            ],
            providers: [
                { provide: WebServerEngine, useClass: ExpressEngine }
            ]
        })
        class EntryModule {
        }

        let app = await Application.bootstrap(EntryModule, { 
            autostart: false
        });
        
        app.inject(WebServerRef).server.options.silent = true;

        app.inject(ExpressRef)
            .application(req, res, next);
    });
}
