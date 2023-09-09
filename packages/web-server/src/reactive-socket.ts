import { Subject, Observable } from "rxjs";

/**
 * A better way to handle websockets
 */
export class ReactiveSocket {
    constructor(
        readonly socket : WebSocket
    ) {
        socket.addEventListener('message', ev => this._message.next(ev));
        socket.addEventListener('close', ev => this._closed.next(ev));
        socket.addEventListener('error', ev => this._error.next(ev));
        socket.addEventListener('open', ev => this._open.next(ev));

        this._closed.subscribe(() => {
            setTimeout(() => {
                this._closed.unsubscribe();
                this._error.unsubscribe();
                this._message.unsubscribe();
                this._open.unsubscribe();
            });
        })
    }

    private _open = new Subject<Event>();
    private _message = new Subject<MessageEvent>();
    private _closed = new Subject<CloseEvent>();
    private _error = new Subject<Event>();

    get open(): Observable<Event> {
        return this._open;
    }

    get message(): Observable<MessageEvent> {
        return this._message;
    }

    get closed(): Observable<CloseEvent> {
        return this._closed;
    }

    get error(): Observable<Event> {
        return this._error;
    }
}