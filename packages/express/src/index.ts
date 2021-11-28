import { WebEvent } from '@alterior/web-server';

export class ExpressEvent {
    static get current() { return WebEvent.request; }
    static get request() { return WebEvent.request; }
}