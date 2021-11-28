import { WebEvent } from '@alterior/web-server';
export * from './express-engine';

export class ExpressEvent {
    static get current() { return WebEvent.request; }
    static get request() { return WebEvent.request; }
}