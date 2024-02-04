import { WebEvent, WebServerEngine } from '@alterior/web-server';
import { ExpressEngine } from './express-engine';

WebServerEngine.default ??= ExpressEngine;

export * from './express-engine';

export class ExpressEvent {
    static get current() { return WebEvent.request; }
    static get request() { return WebEvent.request; }
}
