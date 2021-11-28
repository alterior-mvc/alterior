import { WebEvent } from '@alterior/web-server';

export class FastifyEvent {
    static get current() { return WebEvent.request; }
    static get request() { return WebEvent.request; }
}