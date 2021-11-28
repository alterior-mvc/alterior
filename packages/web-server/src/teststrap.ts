import { Application, AppOptions, AppOptionsAnnotation } from "@alterior/runtime";
import supertest from 'supertest';
import { Module } from "@alterior/di";
import { WebServerOptions } from "./web-server-options";
import { WebServerEngine } from "./web-server-engine";
import { WebServer } from './web-server';

export function teststrap(module : Function, options? : WebServerOptions) {
    return supertest(async (req, res, next) => {

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
        server.engine.app(req, res, next);
    });
}
