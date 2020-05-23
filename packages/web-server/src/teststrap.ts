import { ExpressRef } from "./express-ref";
import { Application, AppOptions, AppOptionsAnnotation } from "@alterior/runtime";
import supertest from 'supertest';
import { Module } from "@alterior/di";
import { WebServerOptions } from "./web-server-options";
import { WebServerRef } from "./web-server-ref";
import { WebServerEngine } from "./web-server-engine";
import { ExpressEngine } from "./express-engine";

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
            autostart: false,
            silent: true
        });
        
        app.inject(WebServerRef).server.options.silent = true;

        app.inject(ExpressRef)
            .application(req, res, next);
    });
}
