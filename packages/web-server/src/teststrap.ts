import { Module, Type } from "@alterior/di";
import { Application, AppOptions, AppOptionsAnnotation } from "@alterior/runtime";
import supertest from 'supertest';
import { WebServer } from './web-server';
import { WebServerOptions } from "./web-server-options";
import { WebRequest } from "./metadata";
import { ServerResponse } from "http";

export function teststrap(module : Function, options? : WebServerOptions) {
    return supertest(async (req: WebRequest, res: ServerResponse, next: () => void) => {

        let appOptionsAnnot = AppOptionsAnnotation.getForClass(module);

        @AppOptions(appOptionsAnnot ? appOptionsAnnot.options : {})
        @Module({
            imports: [ module ]
        })
        class EntryModule {
        }

        let app = await Application.bootstrap(EntryModule, { 
            autostart: false,
            silent: true
        });
        
        let server = WebServer.for(app.injector.get(<Type<any>>module));
        server.options.silent = true;
        server.engine.app(req, res, next);
    });
}
