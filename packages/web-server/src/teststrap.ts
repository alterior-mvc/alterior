import supertest from 'supertest';

import { Module } from "@alterior/di";
import { Application, AppOptions, AppOptionsAnnotation } from "@alterior/runtime";
import { IncomingMessage, ServerResponse } from "http";
import { WebServer } from './web-server';
import { WebServerOptions } from "./web-server-options";
import { RequestBase, ResponseBase } from './metadata';

export function teststrap(module : Function, options? : WebServerOptions) {
    return supertest(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {

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
        
        let server = WebServer.for(app.injector.get(module));
        server.options.silent = true;
        server.engine.app(req as RequestBase, res as ResponseBase, next);
    });
}
