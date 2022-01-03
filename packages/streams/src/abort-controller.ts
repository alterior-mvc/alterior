const K_ABORT = Symbol(`[[abort]]`);

export class AltEventEmitter implements EventTarget {
    #listeners = new Map<string, EventListenerOrEventListenerObject[]>();
    
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
        if (!this.#listeners.has(type))
            this.#listeners.set(type, []);

        this.#listeners.get(type).push(listener);
    }

    dispatchEvent(event: Event): boolean {
        let listeners = this.#listeners.get(event.type) ?? [];
        for (let listener of listeners) {
            if (typeof listener === 'function') {
                listener(event);
            } else {
                listener.handleEvent(event);
            }

            if (event.cancelable && event.defaultPrevented)
                return false;
        }

        return true;
    }

    removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
        if (!this.#listeners.has(type))
            return;
        let listeners = this.#listeners.get(type);
        listeners.splice(listeners.indexOf(callback), 1);
    }

    removeAllListeners?(eventName?: string): void {
        this.#listeners.delete(eventName);
    }

    eventListeners?(eventName?: string): EventListenerOrEventListenerObject[] {
        return this.#listeners.get(eventName) ?? [];
    }
}

export class AltAbortSignal implements AbortSignal {
    constructor() {
        this.#emitter.addEventListener('abort', ev => this.onabort ? this.onabort(ev) : null);
    }

    #aborted = false;
    #emitter = new AltEventEmitter();
    #reason;

    get aborted() { return this.#aborted; }
    get reason() { return this.#reason; }

    [K_ABORT](reason?) {
        if (this.#aborted)
            return;
        this.#aborted = true;
        this.#reason = reason;
        this.#emitter.dispatchEvent({
            type: 'abort', 
            bubbles: false, 
            cancelable: false, 
            cancelBubble: false, 
            composed: false,
            currentTarget: this,
            defaultPrevented: false,
            eventPhase: 0, //Event.NONE,
            isTrusted: true,
            returnValue: undefined,
            srcElement: undefined,
            target: this,
            timeStamp: Date.now(),
            composedPath: () => [],
            initEvent: undefined,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { },
            stopImmediatePropagation() { },
            AT_TARGET: 2, // Event.AT_TARGET,
            BUBBLING_PHASE: 3, // Event.BUBBLING_PHASE,
            CAPTURING_PHASE: 1, //Event.CAPTURING_PHASE,
            NONE: 0, //Event.NONE
        });
    }

    onabort: (this: AbortSignal, ev: Event) => any;

    addEventListener<K extends "abort">(type: K, listener: (this: AbortSignal, ev: AbortSignalEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: any, listener: any, options?: any) {
        this.#emitter.addEventListener(type, listener, options);
    }
    removeEventListener<K extends "abort">(type: K, listener: (this: AbortSignal, ev: AbortSignalEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: any, listener: any, options?: any) {
        this.#emitter.removeEventListener(type, listener, options);
    }

    dispatchEvent(event: Event): boolean {
        return this.#emitter.dispatchEvent(event);
    }

    removeAllListeners?(eventName?: string): void {
        this.#emitter.removeAllListeners(eventName);
    }

    eventListeners?(eventName?: string): EventListenerOrEventListenerObject[] {
        return this.#emitter.eventListeners(eventName);
    }
}

export class AltAbortController implements AbortController {
    signal = new AltAbortSignal();
    abort(reason?): void {
        this.signal[K_ABORT](reason);
    }
}