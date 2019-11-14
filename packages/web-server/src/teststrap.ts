import { ExpressRef } from "./express-ref";
import { Application, RolesService } from "@alterior/runtime";
import * as supertest from 'supertest';
import { Module } from "@alterior/di";
import { WebServerModule, WebServerOptionsRef } from "./web-server.module";
import { WebServerOptions } from "./web-server";
import { RouteEvent } from "./metadata";
import { RouteInstance } from "./route";
import { Annotations } from "@alterior/annotations";
import { WebServerRef } from "./web-server-ref";

export function teststrap(module : Function, options? : WebServerOptions) {
    return supertest(async (req, res, next) => {
        let app = await Application.bootstrap(module, { autostart: false });
        app.inject(WebServerRef).server.options.silent = true;

        app.inject(ExpressRef)
            .application(req, res, next);
    });
}
