import { PromiseController } from "./promise-controller";
import { assert, PeekQueueValue, ResetQueue, ValueWithSize } from "./util";
import * as K from './symbols';
import { PendingAbortRequest } from "./types";
import * as Op from './abstract-ops';

export class AltWritableStreamDefaultController implements WritableStreamDefaultController {
    constructor(sym?) {
        if (sym !== K.NEW)
            throw new TypeError(`Illegal constructor`);
    }

    [K.STRATEGY_HWM] : number;
    [K.QUEUE] : ValueWithSize[] = [];
    [K.QUEUE_TOTAL_SIZE] = 0;
    [K.SIGNAL] : AbortSignal;
    [K.SIGNAL_CONTROLLER] : AbortController;
    [K.STREAM] : AltWritableStream;
    [K.STARTED] = false;
    [K.WRITE_ALGORITHM] : (chunk) => Promise<void>;
    [K.CLOSE_ALGORITHM] : () => Promise<void>;
    [K.ABORT_ALGORITHM] : (error) => Promise<void>;
    [K.STRATEGY_SIZE_ALGORITHM] : QueuingStrategySizeCallback<any>;

    get signal() { return this[K.SIGNAL]; }

    error(error?: any): void {
        let state = this[K.STREAM][K.STATE];
        if (state !== 'writable')
            return;
        
        Op.WritableStreamDefaultControllerError(this, error);
    }

    [K.ERROR_STEPS]() {
        ResetQueue(this);
    }

    [K.ABORT_STEPS](reason) {
        let result = this[K.ABORT_ALGORITHM](reason);
        Op.WritableStreamDefaultControllerClearAlgorithms(this);
        return result;
    }
}

export class AltWritableStreamDefaultWriter<W = any> implements WritableStreamDefaultWriter<W> {
    constructor(stream? : AltWritableStream) {
        if (!stream)
            throw new TypeError(`Missing stream`);
        if (!(stream instanceof AltWritableStream))
            throw new TypeError(`Stream must be a WritableStream`);
        if (Op.IsWritableStreamLocked(stream))
            throw new TypeError(`Stream is already locked to a writer`);
        
        this[K.STREAM] = stream;
        stream[K.WRITER] = this;

        let state = stream[K.STATE];
        if (state === 'writable') {
            if (!Op.WritableStreamCloseQueuedOrInFlight(stream) && stream[K.BACKPRESSURE])
                this[K.READY] = new PromiseController();
            else
                this[K.READY] = PromiseController.resolve();
            this[K.CLOSED] = new PromiseController();
        } else if (state === 'erroring') {
            this[K.READY] = PromiseController.reject(stream[K.STORED_ERROR]).markHandled();
            this[K.CLOSED] = new PromiseController();
        } else if (state === 'closed') {
            this[K.READY] = PromiseController.resolve();
            this[K.CLOSED] = PromiseController.resolve();
        } else {
            assert(() => state === 'errored');
            this[K.READY] = PromiseController.reject(stream[K.STORED_ERROR]).markHandled();
            this[K.CLOSED] = PromiseController.reject(stream[K.STORED_ERROR]).markHandled();
        }
    }

    [K.CLOSED] : PromiseController<void>;
    [K.READY] : PromiseController<void>;
    [K.STREAM] : AltWritableStream;

    get closed(): Promise<void> { return this[K.CLOSED].promise; }

    get desiredSize(): number {
        if (!this[K.STREAM])
            throw new TypeError();
        return Op.WritableStreamDefaultWriterGetDesiredSize(this);
    }

    get ready(): Promise<void> { return this[K.READY].promise; }

    abort(reason?: any): Promise<void> {
        if (!this[K.STREAM])
            return Promise.reject(new TypeError());
        return Op.WritableStreamDefaultWriterAbort(this, reason);
    }
    
    close(): Promise<void> {
        let stream = this[K.STREAM];
        if (!stream)
            return Promise.reject(new TypeError());
        
        if (Op.WritableStreamCloseQueuedOrInFlight(stream))
            return Promise.reject(new TypeError());
        
        return Op.WritableStreamDefaultWriterClose(this);
    }
    
    releaseLock(): void {
        let stream = this[K.STREAM];
        if (!stream)
            return;
        assert(() => !!stream[K.WRITER]);
        
        Op.WritableStreamDefaultWriterRelease(this);
    }
    
    write(chunk: W): Promise<void> {
        if (!this[K.STREAM])
            return Promise.reject(new TypeError());

        return Op.WritableStreamDefaultWriterWrite(this, chunk);
    }
}

export class AltWritableStream<W = any> implements WritableStream<W> {
    constructor(underlyingSink : UnderlyingSink = null, strategy : QueuingStrategy = null) {
        if (underlyingSink && 'type' in underlyingSink)
            throw new RangeError();
        let sizeAlgorithm = Op.ExtractSizeAlgorithm(strategy);
        let highWaterMark = Op.ExtractHighWaterMark(strategy, 1);
        
        Op.SetUpWritableStreamDefaultControllerFromUnderlyingSink(this, underlyingSink, highWaterMark, sizeAlgorithm);
    }

    [K.BACKPRESSURE] = false;
    [K.CLOSE_REQUEST] : PromiseController<void>;
    [K.CONTROLLER] : AltWritableStreamDefaultController;
    [K.IN_FLIGHT_WRITE_REQUEST] : PromiseController<void>;
    [K.IN_FLIGHT_CLOSE_REQUEST] : PromiseController<void>;
    [K.STATE] : 'closed' | 'errored' | 'erroring' | 'writable' = 'writable';
    [K.STORED_ERROR];
    [K.PENDING_ABORT_REQUEST] : PendingAbortRequest;
    [K.WRITER] : AltWritableStreamDefaultWriter;
    [K.WRITE_REQUESTS] : PromiseController<void>[] = [];

    get locked(): boolean {
        return Op.IsWritableStreamLocked(this);
    }

    abort(reason?: any): Promise<void> {
        if (Op.IsWritableStreamLocked(this))
            return Promise.reject(new TypeError());
        
        return Op.WritableStreamAbort(this, reason);
    }

    getWriter(): WritableStreamDefaultWriter<W> {
        return new AltWritableStreamDefaultWriter(this);
    }

    close() {
        if (Op.IsWritableStreamLocked(this))
            return Promise.reject(new TypeError());
        if (Op.WritableStreamCloseQueuedOrInFlight(this))
            return Promise.reject(new TypeError());
        
        return Op.WritableStreamClose(this);
    }
}