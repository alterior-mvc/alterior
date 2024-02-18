import { WebEvent, WebServerEngine } from '@alterior/web-server';
import { ExpressEngine } from './express-engine';
import type * as express from 'express';

WebServerEngine.default ??= ExpressEngine;

export * from './express-engine';

export class ExpressEvent {
    constructor(readonly webEvent: WebEvent) {
    }

    get request() { return this.webEvent.request as express.Request; }
    get response() { return this.webEvent.response as express.Response; }
    get app() { return this.webEvent.server.engine.app as express.Application; };

    static for(event: WebEvent) { return new ExpressEvent(event); }
    static get current() { return new ExpressEvent(WebEvent.current); }
    static get request() { return this.current.request; }
    static get response() { return this.current.response; }
    static get app() { return this.current.app; }
}
