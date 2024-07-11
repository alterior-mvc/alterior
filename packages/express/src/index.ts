import { WebEvent } from '@alterior/web-server';
export * from './express-engine';
import type * as express from 'express';

export class ExpressEvent {
    static get current() { return WebEvent.current as WebEvent<express.Request, express.Response>; }
    static get request() { return WebEvent.request as express.Request; }
    static get response() { return WebEvent.response as express.Response; }
}