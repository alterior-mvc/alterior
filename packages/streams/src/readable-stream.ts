import { AltWritableStream } from "./writable-stream";
import { PromiseController } from "./promise-controller";
import { assert, DequeueValue, QueueWithSizes, SetPromiseIsHandledToTrue, ValueWithSize } from "./util";
import * as K from './symbols';
import * as OP from './abstract-ops';

import { PullIntoDescriptor, ReadableByteStreamQueueEntry, ReadIntoRequest, ReadRequest } from "./types";
import { AltAbortSignal } from "./abort-controller";

export class AltReadableStreamBYOBRequest implements ReadableStreamBYOBRequest {
    static [K.FROM_VIEW](controller : AltReadableByteStreamController, view : ArrayBufferView) {
        let req = new AltReadableStreamBYOBRequest();
        req[K.CONTROLLER] = controller;
        req[K.VIEW] = view;

        return req;
    }

    [K.CONTROLLER] : AltReadableByteStreamController;
    [K.VIEW] : ArrayBufferView;

    get view(): ArrayBufferView { return this[K.VIEW]; }

    respond(bytesWritten: number): void {
        if (!this[K.CONTROLLER])
            throw new TypeError();
        
        assert(() => this[K.VIEW].byteLength > 0);
        assert(() => this[K.VIEW].buffer.byteLength > 0);

        OP.ReadableByteStreamControllerRespond(this[K.CONTROLLER], bytesWritten);
    }

    respondWithNewView(view: ArrayBufferView): void {
        if (!this[K.CONTROLLER])
            throw new TypeError();
        OP.ReadableByteStreamControllerRespondWithNewView(this[K.CONTROLLER], view);
    }

}

export class AltReadableByteStreamController implements ReadableByteStreamController {
    constructor() { }

    get desiredSize() {
        return OP.ReadableByteStreamControllerGetDesiredSize(this);
    }

    get byobRequest() : ReadableStreamBYOBRequest {
        return OP.ReadableByteStreamControllerGetBYOBRequest(this);
    }
    
    [K.BYOB_REQUEST] : AltReadableStreamBYOBRequest = null;
    [K.STREAM] : AltReadableStream;
    [K.STRATEGY_HWM] : number;
    [K.CANCEL_ALGORITHM] : (reason) => Promise<void>;
    [K.PULL_ALGORITHM] : () => Promise<void>;
    [K.AUTO_ALLOCATE_CHUNK_SIZE] : number;
    [K.PULL_AGAIN] = false;
    [K.PULLING] = false;
    [K.QUEUE] : ReadableByteStreamQueueEntry[] = [];
    [K.QUEUE_TOTAL_SIZE] : number = 0;
    [K.CLOSE_REQUESTED] = false;
    [K.STARTED] = false;
    [K.PENDING_PULL_INTOS] : PullIntoDescriptor[] = [];

    [K.CANCEL_STEPS](error) {
        OP.ReadableByteStreamControllerClearPendingPullIntos(this);
        
        this[K.QUEUE] = [];
        this[K.QUEUE_TOTAL_SIZE] = 0;

        let result = this[K.CANCEL_ALGORITHM](error);
        OP.ReadableByteStreamControllerClearAlgorithms(this);
        
        return result;
    }

    [K.PULL_STEPS](readRequest : ReadRequest) {
        assert(() => OP.ReadableStreamHasDefaultReader(this[K.STREAM]));
        if (this[K.QUEUE_TOTAL_SIZE] > 0) {
            assert(() => this[K.STREAM][K.READER][K.READ_REQUEST_SIZE] === 0);
            let entry = this[K.QUEUE].shift();
            this[K.QUEUE_TOTAL_SIZE] -= entry.byteLength;
            OP.ReadableByteStreamControllerHandleQueueDrain(this);
            let view = new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength);
            readRequest.chunk(view);
            return;
        }

        if (this[K.AUTO_ALLOCATE_CHUNK_SIZE] !== void 0) {
            let buffer : ArrayBuffer;

            try {
                buffer = new ArrayBuffer(this[K.AUTO_ALLOCATE_CHUNK_SIZE]);
            } catch (e) {
                readRequest.error(e);
                return;
            }

            this[K.PENDING_PULL_INTOS].push({
                buffer, 
                bufferByteLength: this[K.AUTO_ALLOCATE_CHUNK_SIZE],
                byteOffset: 0,
                byteLength: this[K.AUTO_ALLOCATE_CHUNK_SIZE],
                bytesFilled: 0,
                elementSize: 1,
                viewConstructor: Uint8Array,
                readerType: 'default'
            });
        }

        assert(() => this[K.STREAM][K.STATE] === 'readable');
        (<AltReadableStreamDefaultReader>this[K.STREAM][K.READER])[K.READ_REQUESTS].push(readRequest);
    }

    close(): void {
        if (this[K.CLOSE_REQUESTED])
            throw new TypeError(`A close() request is already in progress`);
        if (this[K.STREAM][K.STATE] !== 'readable')
            throw new TypeError(`The readable stream must be in a readable state`);
        
            OP.ReadableByteStreamControllerClose(this);
    }
    
    enqueue(chunk: ArrayBufferView): void {
        if (chunk.byteLength === 0)
            throw new TypeError();
        if (chunk.buffer.byteLength === 0)
            throw new TypeError();
        if (this[K.CLOSE_REQUESTED])
            throw new TypeError();
        if (this[K.STREAM][K.STATE] !== 'readable')
            throw new TypeError();
        
        return OP.ReadableByteStreamControllerEnqueue(this, chunk);
    }

    error(error?: any): void {
        OP.ReadableByteStreamControllerError(this, error);
    }
}

export class AltReadableStreamDefaultController implements ReadableStreamDefaultController, QueueWithSizes<any> {
    constructor() {}

    [K.STREAM] : AltReadableStream<any>;
    [K.QUEUE] : ValueWithSize[] = [];
    [K.QUEUE_TOTAL_SIZE] : number = 0;
    [K.STARTED] = false;
    [K.CLOSE_REQUESTED] = false;
    [K.PULL_AGAIN] = false;
    [K.PULLING] = false;
    [K.STRATEGY_SIZE_ALGORITHM] : QueuingStrategySizeCallback;
    [K.STRATEGY_HWM] : number;
    [K.CANCEL_ALGORITHM] : (reason) => Promise<void>;
    [K.PULL_ALGORITHM] : () => Promise<void>;

    get desiredSize() {
        return OP.ReadableStreamDefaultControllerGetDesiredSize(this);
    }

    close(): void {
        if (!OP.ReadableStreamDefaultControllerCanCloseOrEnqueue(this))
            throw new TypeError();
        OP.ReadableStreamDefaultControllerClose(this);
    }
    
    enqueue(chunk: any): void {
        if (!OP.ReadableStreamDefaultControllerCanCloseOrEnqueue(this))
            throw new TypeError();

        OP.ReadableStreamDefaultControllerEnqueue(this, chunk);
    }

    error(error?: any): void {
        OP.ReadableStreamDefaultControllerError(this, error);
    }

    [K.CANCEL_STEPS](error) {
        this[K.QUEUE] = [];
        this[K.QUEUE_TOTAL_SIZE] = 0;
        let result = this[K.CANCEL_ALGORITHM](error);
        OP.ReadableStreamDefaultControllerClearAlgorithms(this);
        return result;
    }

    [K.PULL_STEPS](readRequest : ReadRequest) {
        if (this[K.QUEUE].length > 0) {
            let chunk = DequeueValue(this);
            if (this[K.CLOSE_REQUESTED] && this[K.QUEUE].length === 0) {
                OP.ReadableStreamDefaultControllerClearAlgorithms(this);
                OP.ReadableStreamClose(this[K.STREAM]);
            } else {
                OP.ReadableStreamDefaultControllerPullIfNeeded(this);
            }

            readRequest.chunk(chunk);
        } else {
            (<AltReadableStreamDefaultReader>this[K.STREAM][K.READER])[K.READ_REQUESTS].push(readRequest);
            OP.ReadableStreamDefaultControllerPullIfNeeded(this);
        }
    }
}

export class AltReadableStreamBYOBReader implements ReadableStreamBYOBReader {
    constructor(
        stream? : ReadableStream
    ) {
        if (!stream)
            throw new TypeError(`Missing stream`);
        if (!(stream instanceof AltReadableStream))
            throw new TypeError(`Incompatible stream`);
        
        if (stream.locked)
            throw new TypeError(`ReadableStreamBYOBReader constructor can only accept readable streams that are not yet locked to a reader`);
        
        if (!(stream[K.CONTROLLER] instanceof AltReadableByteStreamController))
            throw new TypeError();

        OP.ReadableStreamReaderGenericInitialize(this, stream);

        this[K.READ_INTO_REQUESTS] = [];
    }

    [K.STREAM] : AltReadableStream;
    [K.CLOSED] : PromiseController<void>;
    [K.READ_INTO_REQUESTS] : ReadIntoRequest[];

    get closed(): Promise<void> { return this[K.CLOSED].promise; }
    get [K.READ_REQUEST_SIZE]() { return this[K.READ_INTO_REQUESTS].length; }

    cancel(reason?: any): Promise<void> {
        if (!this[K.STREAM])
            Promise.reject(new TypeError(`Cannot cancel a ReadableStreamBYOBReader which has no ReadableStream`));
        
        return OP.ReadableStreamReaderGenericCancel(this, reason);
    }

    read<T extends ArrayBufferView>(view: T): Promise<ReadableStreamReadResult<T>> {
        if (view.byteLength === 0)
            return Promise.reject(new TypeError(`Cannot use a zero-length array view for read()`));
        if (view.buffer.byteLength === 0)
            return Promise.reject(new TypeError(`Cannot use a zero-length array buffer for read()`));
        
        if (!this[K.STREAM])
            return Promise.reject(new TypeError(`Cannot read when no stream is attached`));
        
        let promise = new PromiseController<ReadableStreamReadResult<T>>();
        let request : ReadIntoRequest = {
            chunk: chunk => promise.resolve({ value: chunk, done: false }),
            close: chunk => promise.resolve({ value: chunk, done: true }),
            error: e => promise.reject(e)
        };

        // https://streams.spec.whatwg.org/#readable-stream-byob-reader-read
        OP.ReadableStreamBYOBReaderRead(this, view, request);
        
        return promise.promise;
    }

    releaseLock(): void {
        if (!this[K.STREAM])
            return;
        if (this[K.READ_INTO_REQUESTS].length > 0)
            throw new TypeError(`Cannot release lock while there are pending read() requests`);
        
        OP.ReadableStreamReaderGenericRelease(this);
    }
}

export class AltReadableStreamDefaultReader<R = any> implements ReadableStreamDefaultReader<R> {
    constructor(
        stream? : ReadableStream
    ) { 
        if (!stream)
            throw new TypeError(`Missing stream`);
        
        if (!(stream instanceof AltReadableStream))
            throw new TypeError(`Incompatible stream`);
        
        if (stream.locked)
            throw new TypeError(`ReadableStreamDefaultReader constructor can only accept readable streams that are not yet locked to a reader`);
        
        // https://streams.spec.whatwg.org/#readable-stream-reader-generic-initialize
        OP.ReadableStreamReaderGenericInitialize(this, stream);
    }

    [K.STREAM] : AltReadableStream;
    [K.CLOSED] : PromiseController<void>;
    [K.READ_REQUESTS] : ReadRequest[] = [];

    get closed(): Promise<void> { return this[K.CLOSED].promise; }
    get [K.READ_REQUEST_SIZE]() { return this[K.READ_REQUESTS].length; }

    cancel(reason?: any): Promise<void> {
        if (!this[K.STREAM])
            return Promise.reject(new TypeError(`Cannot cancel a ReadableStreamBYOBReader which has no ReadableStream`));
        
        return OP.ReadableStreamReaderGenericCancel(this, reason);
    }

    read(): Promise<ReadableStreamReadResult<any>> {
        if (!this[K.STREAM])
            return Promise.reject(new TypeError());

        let promise = new PromiseController<ReadableStreamReadResult<any>>();

        let request : ReadRequest = {
            chunk: chunk => {
                promise.resolve({ value: chunk, done: false })
            },
            close: () => promise.resolve({ value: undefined, done: true }),
            error: e => promise.reject(e)
        };
        
        OP.ReadableStreamDefaultReaderRead(this, request);

        return promise.promise;
    }

    releaseLock(): void {
        if (!this[K.STREAM])
            return;
        if (this[K.READ_REQUESTS].length > 0)
            throw new TypeError(`Cannot release while there are pending read() requests`);

        OP.ReadableStreamReaderGenericRelease(this);
    }
}
export class AltReadableStream<T = any> implements ReadableStream<T> {
    constructor(
        underlyingSource : UnderlyingSource | UnderlyingByteSource,
        queuingStrategy? : QueuingStrategy
    ) {
        if (!['undefined', 'object'].includes(typeof underlyingSource) || underlyingSource === null)
            throw new TypeError(`underlyingSource must be an object (or not present)`);
        
        underlyingSource ??= null;

        if (underlyingSource) {
            if (![void 0, 'bytes'].includes(underlyingSource.type))
                throw new TypeError(`Invalid 'type' specified in underlyingSource ('${underlyingSource['type']}')`);
        }

        let highWaterMark = queuingStrategy?.highWaterMark;
        if (highWaterMark !== void 0) {
            if (typeof highWaterMark !== 'number' || Number.isNaN(highWaterMark) || highWaterMark < 0)
                throw new RangeError();
        }

        if (underlyingSource?.type === 'bytes') {
            if (queuingStrategy && 'size' in queuingStrategy)
                throw new RangeError();
            
            highWaterMark ??= 0;
            OP.SetUpReadableByteStreamControllerFromUnderlyingSource(
                this, 
                <UnderlyingByteSource>underlyingSource, 
                highWaterMark
            );
        } else {
            highWaterMark ??= 1;
            
            let sizeAlgorithm = OP.ExtractSizeAlgorithm(queuingStrategy);

            OP.SetUpReadableStreamDefaultControllerFromUnderlyingSource(
                this, underlyingSource, highWaterMark, sizeAlgorithm
            );
        }
    }

	[K.READER] : AltReadableStreamBYOBReader | AltReadableStreamDefaultReader = null;
    [K.CONTROLLER] : AltReadableStreamDefaultController | AltReadableByteStreamController
    [K.DISTURBED] = false;
    [K.STATE] : 'closed' | 'errored' | 'readable' = 'readable';
    [K.STORED_ERROR] : Error;

	get locked(): boolean { return OP.IsReadableStreamLocked(this); }

	cancel(reason?: any): Promise<void> {
        if (this.locked)
            return Promise.reject(new TypeError());
        
        return OP.ReadableStreamCancel(this, reason);
	}

	getReader(options: { mode: 'byob'; }): ReadableStreamBYOBReader;
	getReader(): ReadableStreamDefaultReader<T>;
	getReader(options?: any): any {
        if (!['undefined', 'object'].includes(typeof options))
            throw new TypeError();
        
        let mode : string;
        if (!['undefined', 'string'].includes(typeof options?.mode))
            mode = ''+options?.mode;
        else
            mode = options?.mode;

        if (![void 0, 'byob'].includes(mode))
            throw new TypeError();

        if (mode === 'byob')
            return OP.AcquireReadableStreamBYOBReader(this);
        else
            return OP.AcquireReadableStreamDefaultReader(this);
	}

	pipeThrough<U>(transform: { writable: WritableStream<T>; readable: ReadableStream<U>; }, options?: PipeOptions): ReadableStream<U> {
        if (transform === void 0 || typeof transform !== 'object' || !transform.writable)
            throw new TypeError();

        if (!(transform instanceof AltWritableStream))
            throw new TypeError(`transform.writable must be a WritableStream`);
        
        if (OP.IsReadableStreamLocked(this))
            throw new TypeError(`ReadableStream is already in use`);
        if (transform.writable.locked)
            throw new TypeError(`WritableStream is already in use`);
        
        SetPromiseIsHandledToTrue(OP.ReadableStreamPipeTo(
            this, 
            <AltWritableStream>transform.writable, 
            options?.preventClose, 
            options?.preventAbort, 
            options?.preventCancel, 
            options?.signal
        ));

        return transform.readable;
	}

	pipeTo(dest: WritableStream<T>, options?: PipeOptions): Promise<void> {
        if (this.locked || dest.locked)
            return Promise.reject(new TypeError());

        if (options?.signal !== void 0) {
            if (options?.signal === null || typeof options?.signal !== 'object')
                throw new TypeError();
            if (!(options?.signal instanceof AltAbortSignal))
                throw new TypeError();
        }

        return OP.ReadableStreamPipeTo(
            this, 
            <AltWritableStream>dest, 
            Boolean(options?.preventClose ?? false), 
            Boolean(options?.preventAbort ?? false), 
            Boolean(options?.preventCancel ?? false), 
            options?.signal
        );
	}

	tee(): [ReadableStream<T>, ReadableStream<T>] {
        return OP.ReadableStreamTee(this, false);
	}
}