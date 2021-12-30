import { assert, copyDataBlockBytes, ValueWithSize } from "./util";


interface ReadIntoRequest {
    chunk : (chunk) => void;
    close : (chunk) => void;
    error : (value) => void;
}

interface ReadRequest {
    chunk : (chunk) => void;
    close : () => void;
    error : (value) => void;
}

const K_READER = Symbol(`[[reader]]`);
const K_STATE = Symbol(`[[state]]`);
const K_STORED_ERROR = Symbol(`[[storedError]]`);
const K_FLAG_ERROR = Symbol(`[[flagError]]`);
const K_ON_CLOSE = Symbol(`[[onClose]]`);
const K_DISTURBED = Symbol('[[disturbed]]');
const K_CONTROLLER = Symbol(`[[controller]]`);
const K_PULL_INTO = Symbol(`[[pullInto]]`);
const K_PULL_STEPS = Symbol(`[[pullSteps]]`);
const K_VIEW = Symbol(`[[view]]`);
const K_FROM_UNDERLYING_SOURCE = Symbol(`[[fromUnderlyingSource]]`);
const K_FROM_VIEW = Symbol(`[[fromView]]`);
const K_CLOSE = Symbol(`[[close]]`);
const K_READ_REQUEST_SIZE = Symbol(`[[readRequestSize]]`);
const K_RESPOND = Symbol(`[[respond]]`);
const K_RESPOND_WITH_NEW_VIEW = Symbol(`[[respondWithNewView]]`);
const K_FULFILL_REQUEST = Symbol(`[[fulfillRequest]]`);
const K_READ_REQUESTS = Symbol(`[[readRequests]]`);
const K_READ_INTO_REQUESTS = Symbol(`[[readIntoRequests]]`);

interface PullIntoDescriptor {
    buffer : ArrayBuffer;
    bufferByteLength : number;
    byteOffset : number;
    byteLength : number;
    bytesFilled : number;
    elementSize : number;
    viewConstructor : Function;
    readerType : 'default' | 'byob';
}

interface ReadableByteStreamQueueEntry {
    buffer : ArrayBuffer;
    byteOffset : number;
    byteLength : number;
}

export class AltReadableStreamBYOBRequest implements ReadableStreamBYOBRequest {
    private constructor() {
    }

    static [K_FROM_VIEW](controller : AltReadableByteStreamController, view : ArrayBufferView) {
        let req = new AltReadableStreamBYOBRequest();
        req.#controller = controller;
        req.#view = view;

        return req;
    }

    #controller : AltReadableByteStreamController;
    #view : ArrayBufferView;

    get view(): ArrayBufferView { return this.#view; }
    get [K_CONTROLLER]() { return this.#controller; }
    set [K_CONTROLLER](value) { this.#controller = value; }
    get [K_VIEW]() { return this.#view; }
    set [K_VIEW](value) { this.#view = value; }

    respond(bytesWritten: number): void {
        if (!this.#controller)
            throw new TypeError();
        
        assert(() => this.#view.byteLength > 0);
        assert(() => this.#view.buffer.byteLength > 0);

        this.#controller[K_RESPOND](bytesWritten);
    }

    respondWithNewView(view: ArrayBufferView): void {
        this.#controller[K_RESPOND_WITH_NEW_VIEW](view);
    }

}

function isBYOBReader(reader) {
    if (reader instanceof AltReadableStreamBYOBReader)
        return true;
    else if (typeof ReadableStreamBYOBReader !== 'undefined' && reader instanceof ReadableStreamBYOBReader)
        return true;

    return false;
}

function isDefaultReader(reader) {
    if (reader instanceof AltReadableStreamDefaultReader)
        return true;
    else if (typeof ReadableStreamDefaultReader !== 'undefined' && reader instanceof ReadableStreamDefaultReader)
        return true;
    
    return false;
}

function hasBYOBReader(stream : AltReadableStream) {
    return isBYOBReader(stream[K_READER]);
}

function hasDefaultReader(stream : AltReadableStream) {
    return isDefaultReader(stream[K_READER]);
}

export class AltReadableByteStreamController implements ReadableByteStreamController {
    private constructor() { }

    get byobRequest() : ReadableStreamBYOBRequest {
        if (!this.#byobRequest && this.#pendingPullIntos.length > 0) {
            let first = this.#pendingPullIntos[0];
            let ctor : any = first.viewConstructor || Uint8Array;
            let view : ArrayBufferView = new ctor(first.buffer, first.byteOffset + first.bytesFilled, first.byteLength - first.bytesFilled);

            this.#byobRequest = AltReadableStreamBYOBRequest[K_FROM_VIEW](this, view);
        }

        return this.#byobRequest;
    }
    
    #byobRequest : AltReadableStreamBYOBRequest = null;
    #stream : AltReadableStream;
    #strategyHWM : number;
    #cancelCallback : ReadableStreamDefaultControllerCallback<any>;
    #pullCallback : ReadableStreamDefaultControllerCallback<any>;
    #autoAllocateChunkSize : number;
    #pullAgain = false;
    #pulling = false;
    #queue : ReadableByteStreamQueueEntry[] = [];
    #queueTotalSize : number = 0;
    #closeRequested = false;
    #started = false;
    #pendingPullIntos : PullIntoDescriptor[] = [];

    [K_PULL_STEPS](readRequest : ReadRequest) {
        assert(() => hasDefaultReader(this.#stream));
        if (this.#queueTotalSize > 0) {
            assert(() => this.#stream[K_READER][K_READ_REQUEST_SIZE] === 0);
            let entry = this.#queue.shift();
            this.#queueTotalSize -= entry.byteLength;
            this.handleQueueDrain();
            let view = new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength);
            readRequest.chunk(view);
            return;
        }

        if (this.#autoAllocateChunkSize !== void 0) {
            let buffer : ArrayBuffer;

            try {
                buffer = new ArrayBuffer(this.#autoAllocateChunkSize);
            } catch (e) {
                readRequest.error(e);
                return;
            }

            this.#pendingPullIntos.push({
                buffer, 
                bufferByteLength: this.#autoAllocateChunkSize,
                byteOffset: 0,
                byteLength: this.#autoAllocateChunkSize,
                bytesFilled: 0,
                elementSize: 1,
                viewConstructor: Uint8Array,
                readerType: 'default'
            });
        }

        assert(() => this.streamState === 'readable');
        (<AltReadableStreamDefaultReader>this.#stream[K_READER])[K_READ_REQUESTS].push(readRequest);
    }

    private handleQueueDrain() {
        assert(() => this.streamState === 'readable');
        if (this.#queueTotalSize === 0 && this.#closeRequested) {
            this.#pullCallback = undefined;
            this.#cancelCallback = undefined;
            this.#stream[K_CLOSE]();
        } else {
            this.pullIfNeeded();
        }
    }

    static [K_FROM_UNDERLYING_SOURCE](
        stream : AltReadableStream, 
        underlyingSource : UnderlyingByteSource,
        highWaterMark : number
    ) {
        assert(() => typeof stream[K_CONTROLLER] === 'undefined');

        let start = () => {};
        let pull = () => Promise.resolve();
        let cancel = reason => Promise.resolve();

        if (underlyingSource.start)
            start = () => underlyingSource.start.call(underlyingSource, controller);
        if (underlyingSource.pull)
            pull = () => underlyingSource.pull.call(underlyingSource, controller);
        if (underlyingSource.cancel)
            cancel = reason => underlyingSource.cancel.call(underlyingSource, reason);
        
        let controller = new AltReadableByteStreamController();
        controller.#stream = stream;
        controller.#strategyHWM = highWaterMark;
        controller.#cancelCallback = cancel;
        controller.#pullCallback = pull;
        stream[K_CONTROLLER] = controller;
        controller.#autoAllocateChunkSize = underlyingSource.autoAllocateChunkSize;

        if (controller.#autoAllocateChunkSize !== void 0) {
            assert(() => Number.isInteger(controller.#autoAllocateChunkSize));
            assert(() => controller.#autoAllocateChunkSize > 0);
        }

        controller.start(start);

        return controller;
    }

    private async start(callback : ReadableByteStreamControllerCallback) {
        try {
            await callback(this);
            this.#started = true;
            assert(() => !this.#pulling);
            assert(() => !this.#pullAgain);
            this.pullIfNeeded();
        } catch (e) {
            this.handleError(e);
        }
    }

    [K_RESPOND](bytesWritten : number) {
        assert(() => this.#pendingPullIntos.length > 0);
        let first = this.#pendingPullIntos[0];
        if (this.streamState === 'closed' && bytesWritten !== 0)
            throw new TypeError();
        
        assert(() => this.streamState === 'readable');
        if (bytesWritten === 0)
            throw new TypeError();
        if (first.bytesFilled + bytesWritten > first.byteLength)
            throw new RangeError();
        
        // Probably not useful to implement:
        // https://streams.spec.whatwg.org/#transfer-array-buffer
        
        this.respondInternal(bytesWritten);
    }

    [K_RESPOND_WITH_NEW_VIEW](view : ArrayBufferView) {
        assert(() => this.#pendingPullIntos.length > 0);
        let first = this.#pendingPullIntos[0];
        
        assert(() => ['readable', 'closed'].includes(this.streamState));

        if (this.streamState === 'closed') {
            if (view.byteLength !== 0)
                throw new TypeError();
        } else {
            if (view.byteLength === 0)
                throw new TypeError();
        }

        if (first.byteOffset + first.bytesFilled !== view.byteOffset)
            throw new RangeError();
        if (first.bufferByteLength !== view.buffer.byteLength)
            throw new RangeError();
        if (first.bytesFilled + view.byteLength > first.byteLength)
            throw new RangeError();
        
        this.respondInternal(view.byteLength);
    }

    [K_PULL_INTO](view : ArrayBufferView, request : ReadIntoRequest) {
        let elementSize = view['BYTES_PER_ELEMENT'] ?? 1;
        let ctor = DataView;

        let byteOffset = view.byteOffset;
        let byteLength = view.byteLength;
        let buffer = view.buffer;
        let descriptor : PullIntoDescriptor = {
            buffer, 
            bufferByteLength: buffer.byteLength, 
            byteOffset, 
            byteLength, 
            bytesFilled: 0,
            elementSize: elementSize, 
            viewConstructor: ctor, 
            readerType: 'byob'
        };

        if (this.#pendingPullIntos.length > 0) {
            this.#pendingPullIntos.push(descriptor);
            (<AltReadableStreamBYOBReader>this.#stream[K_READER])[K_READ_INTO_REQUESTS].push(request);
            return;
        }

        if (this.streamState === 'closed') {
            let emptyView = new ctor(descriptor.buffer, descriptor.byteOffset, 0);
            request.close(emptyView);
            return;
        }

        if (this.#queueTotalSize > 0) {
            if (this.fillPullIntoDescriptorFromQueue(descriptor)) {
                let filledView = this.convertPullInto(descriptor);
                this.handleQueueDrain();
                request.chunk(filledView);
                return;
            } else if (this.#closeRequested) {
                let e = new TypeError();
                this.handleError(e);
                request.error(e);
                return;
            }
        }

        this.#pendingPullIntos.push(descriptor);
        (<AltReadableStreamBYOBReader>this.#stream[K_READER])[K_READ_INTO_REQUESTS].push(request);
        this.pullIfNeeded();
    }

    private respondInternal(bytesWritten : number) {
        let first = this.#pendingPullIntos[0];
        
        this.invalidateBYOBRequest();
        if (this.streamState === 'closed') {
            assert(() => bytesWritten === 0);
            this.respondInClosedState(first);
        } else {
            assert(() => this.streamState === 'readable');
            assert(() => bytesWritten > 0);
            this.respondInReadableState(bytesWritten, first);
        }
    }

    private respondInClosedState(firstDescriptor : PullIntoDescriptor) {
        assert(() => firstDescriptor.bytesFilled === 0);
        let reader = this.#stream[K_READER];
        
        if (isBYOBReader(reader)) {
            while (reader[K_READ_REQUEST_SIZE] > 0) {
                this.commitPullInto(this.shiftPendingPullInto());
            }
        }
    }

    private commitPullInto(descriptor : PullIntoDescriptor) {
        assert(() => this.streamState !== 'errored');
        let done = false;
        if (this.streamState === 'closed') {
            assert(() => descriptor.bytesFilled === 0);
            done = true;
        }

        let filledView = this.convertPullInto(descriptor);
        this.#stream[K_READER][K_FULFILL_REQUEST](filledView, done);
    }

    private convertPullInto(descriptor : PullIntoDescriptor) {
        assert(() => descriptor.bytesFilled <= descriptor.byteLength);
        assert(() => descriptor.bytesFilled % descriptor.elementSize === 0);
        
        // Probably not useful to implement:
        // https://streams.spec.whatwg.org/#transfer-array-buffer

        let ctor : any = descriptor.viewConstructor || Uint8Array;
        return <ArrayBufferView> new ctor(descriptor.buffer, descriptor.byteOffset, descriptor.bytesFilled / descriptor.elementSize);
    }

    private shiftPendingPullInto() {
        assert(() => !this.#byobRequest);
        return this.#pendingPullIntos.shift();
    }

    private respondInReadableState(bytesWritten : number, descriptor : PullIntoDescriptor) {
        assert(() => descriptor.bytesFilled + bytesWritten <= descriptor.byteLength);
        this.fillHeadPullIntoDescriptor(bytesWritten, descriptor);
        if (descriptor.bytesFilled < descriptor.elementSize)
            return;
        this.shiftPendingPullInto();
        let remainderSize = descriptor.bytesFilled % descriptor.elementSize;
        if (remainderSize > 0) {
            let end = descriptor.byteOffset + descriptor.bytesFilled;
            let remainder = descriptor.buffer.slice(end - remainderSize, end);
            this.enqueueChunkToQueue(remainder, 0, remainder.byteLength);
        }

        descriptor.bytesFilled -= remainderSize;
        this.commitPullInto(descriptor);
        this.processPullIntoDescriptorsUsingQueue();
    }

    private processPullIntoDescriptorsUsingQueue() {
        assert(() => !this.#closeRequested);
        while (this.#pendingPullIntos.length > 0) {
            if (this.#queueTotalSize === 0)
                return;
            let descriptor = this.#pendingPullIntos[0];

            if (this.fillPullIntoDescriptorFromQueue(descriptor)) {
                this.shiftPendingPullInto();
                this.commitPullInto(descriptor);
            }
        }
    }

    private fillPullIntoDescriptorFromQueue(descriptor : PullIntoDescriptor): boolean {
        let elementSize = descriptor.elementSize;
        let currentAlignedBytes = descriptor.bytesFilled - (descriptor.bytesFilled % elementSize);
        let maxBytesToCopy = Math.min(this.#queueTotalSize, descriptor.byteLength - descriptor.bytesFilled);
        let maxBytesFilled = descriptor.bytesFilled + maxBytesToCopy;
        let maxAlignedBytes = maxBytesFilled - (maxBytesFilled % elementSize);
        let totalBytesToCopyRemaining = maxBytesToCopy;
        let ready = false;
        if (maxAlignedBytes > currentAlignedBytes) {
            totalBytesToCopyRemaining = maxAlignedBytes - descriptor.bytesFilled;
            ready = true;
        }

        while (totalBytesToCopyRemaining > 0) {
            let headOfQueue = this.#queue[0];
            let bytesToCopy = Math.min(totalBytesToCopyRemaining, headOfQueue.byteLength);
            let destStart = descriptor.byteOffset + descriptor.bytesFilled;
            copyDataBlockBytes(descriptor.buffer, destStart, headOfQueue.buffer, headOfQueue.byteOffset, bytesToCopy);
            headOfQueue.byteOffset += bytesToCopy;
            headOfQueue.byteLength -= bytesToCopy;
            if (headOfQueue.byteLength <= 0)
                this.#queue.shift();

            this.#queueTotalSize -= bytesToCopy;
            this.fillHeadPullIntoDescriptor(bytesToCopy, descriptor);
            totalBytesToCopyRemaining -= bytesToCopy;
        }

        if (!ready) {
            assert(() => this.#queueTotalSize === 0);
            assert(() => descriptor.bytesFilled > 0);
            assert(() => descriptor.bytesFilled < descriptor.elementSize);
        }

        return ready;
    }

    private enqueueChunkToQueue(buffer : ArrayBuffer, byteOffset : number, byteLength : number) {
        this.#queue.push({ buffer, byteLength, byteOffset });
        this.#queueTotalSize += byteLength;
    }

    private fillHeadPullIntoDescriptor(size : number, descriptor : PullIntoDescriptor) {
        assert(() => this.#pendingPullIntos.length === 0 || this.#pendingPullIntos[0] === descriptor);
        assert(() => !this.#byobRequest);
        descriptor.bytesFilled += size;
    }

    private invalidateBYOBRequest() {
        if (!this.#byobRequest)
            return;
        this.#byobRequest[K_CONTROLLER] = null;
        this.#byobRequest[K_VIEW] = null;
        this.#byobRequest = null;
    }

    private handleError(e) {
        if (this.#stream[K_STATE] !== 'readable')
                return;
        this.#pendingPullIntos = [];
        this.#queue = [];
        this.#queueTotalSize = 0;
        this.#pullCallback = undefined;
        this.#cancelCallback = undefined;
        this.#stream[K_CLOSE](e);
    }

    close(): void {
        if (this.#closeRequested)
            throw new TypeError(`A close() request is already in progress`);
        if (this.streamState !== 'readable')
            throw new TypeError(`The readable stream must be in a readable state`);
        
        if (this.#queueTotalSize > 0) {
            this.#closeRequested = true;
            return;
        }

        if (this.#pendingPullIntos.length > 0) {
            let first = this.#pendingPullIntos[0];
            if (first.bytesFilled > 0) {
                let e = new TypeError();
                this.handleError(e);
                throw e;
            }
        }

        this.#pullCallback = undefined;
        this.#cancelCallback = undefined;
        this.#stream[K_CLOSE]();
    }
    
    enqueue(chunk: ArrayBufferView): void {
        throw new Error("Method not implemented.");
    }

    error(error?: any): void {
        throw new Error("Method not implemented.");
    }

    private get streamState() {
        return this.#stream[K_STATE];
    }

    get desiredSize() {
        if (this.streamState === 'errored')
            return null;
        if (this.streamState === 'closed')
            return 0;
        
        return this.#strategyHWM - this.#queueTotalSize;
    }

    private get shouldCallPull() {
        if (this.streamState !== 'readable' || this.#closeRequested || !this.#started)
            return false;

        if (this.#stream.locked && this.#stream[K_READER][K_READ_REQUEST_SIZE] > 0)
            return true;
        
        assert(() => this.desiredSize !== null);
        return this.desiredSize > 0;
    }

    private async pullIfNeeded() {
        if (!this.shouldCallPull)
            return;

        if (this.#pulling) {
            this.#pullAgain = true;
            return;
        }

        assert(() => !this.#pullAgain);
        this.#pulling = true;

        try {
            await this.#pullCallback(this);
            this.#pulling = false;
            if (this.#pullAgain) {
                this.#pullAgain = false;
                this.pullIfNeeded();
            }
        } catch (e) {
            this.handleError(e);
        }


    }
}

export class AltReadableStreamDefaultController implements ReadableStreamDefaultController {
    private constructor() {}

    #stream : AltReadableStream<any>;
    #queue : ValueWithSize[] = [];
    #queueTotalSize : number = 0;
    #started = false;
    #closeRequested = false;
    #pullAgain = false;
    #pulling = false;
    #strategySizeAlgorithm : QueuingStrategySizeCallback;
    #strategyHWM : number;
    #cancelCallback : ReadableStreamDefaultControllerCallback<any>;
    #pullCallback : ReadableStreamDefaultControllerCallback<any>;

    static [K_FROM_UNDERLYING_SOURCE](
        stream : AltReadableStream, 
        underlyingSource : UnderlyingSource,
        sizeAlgorithm : QueuingStrategySizeCallback,
        highWaterMark : number
    ) {
        assert(() => typeof stream[K_CONTROLLER] === 'undefined');

        let start = () => {};
        let pull = () => Promise.resolve();
        let cancel = reason => Promise.resolve();

        if (underlyingSource.start)
            start = () => underlyingSource.start.call(underlyingSource, controller);
        if (underlyingSource.pull)
            pull = () => underlyingSource.pull.call(underlyingSource, controller);
        if (underlyingSource.cancel)
            cancel = reason => underlyingSource.cancel.call(underlyingSource, reason);
        
        let controller = new AltReadableStreamDefaultController();
        controller.#stream = stream;
        controller.#strategySizeAlgorithm = sizeAlgorithm;
        controller.#strategyHWM = highWaterMark;
        controller.#cancelCallback = cancel;
        controller.#pullCallback = pull;
        stream[K_CONTROLLER] = controller;

        controller.start(start);

        return controller;
    }

    private async start(callback : ReadableStreamDefaultControllerCallback<any>) {
        try {
            await callback(this);
            this.#started = true;
            assert(() => !this.#pulling);
            assert(() => !this.#pullAgain);
            this.pullIfNeeded();
        } catch (e) {
            this.handleError(e);
        }
    }

    private handleError(e) {
        if (this.#stream[K_STATE] !== 'readable')
                return;
        this.#queue = [];
        this.#queueTotalSize = 0;
        this.#pullCallback = undefined;
        this.#cancelCallback = undefined;
        this.#strategySizeAlgorithm = undefined;
        this.#stream[K_CLOSE](e);
    }

    close(): void {
        if (!this.canCloseOrEnqueue)
            throw new TypeError();
        
        this.#closeRequested = true;
        if (this.#queue.length === 0) {
            this.#pullCallback = undefined;
            this.#cancelCallback = undefined;
            this.#stream[K_CLOSE]();
        }
    }
    
    enqueue(chunk: any): void {
        if (!this.canCloseOrEnqueue)
            throw new TypeError();
        
        if (this.#stream.locked && this.#stream[K_READER][K_READ_REQUEST_SIZE] > 0) {
            this.#stream[K_READER][K_FULFILL_REQUEST](chunk, false);
            return;
        }
        
        let chunkSize : number;
        try {
            chunkSize = this.#strategySizeAlgorithm(chunk);
        } catch (e) {
            this.handleError(e);
            throw e;
        }

        this.enqueueValueWithSize(chunk, chunkSize);
    }

    private dequeueValue() {
        assert(() => this.#queue.length > 0);
        let valueWithSize = this.#queue.shift();
        this.#queueTotalSize -= valueWithSize.size;
        if (this.#queueTotalSize < 0)
            this.#queueTotalSize = 0;
        
        return valueWithSize.value;
    }

    private peekQueueValue() {
        assert(() => this.#queue.length > 0);
        return this.#queue[0].value;
    }

    private enqueueValueWithSize(value : any, size : number) {
        if (size < 0)
           throw new RangeError();

        if (!Number.isFinite(size))
            throw new RangeError();

        this.#queue.push({ value, size });
        this.#queueTotalSize += size;
    }

    error(error?: any): void {
        this.handleError(error);
    }

    private get canCloseOrEnqueue() {
        return this.streamState === 'readable' && !this.#closeRequested;
    }

    private get streamState() {
        return this.#stream[K_STATE];
    }

    get desiredSize() {
        if (this.streamState === 'errored')
            return null;
        if (this.streamState === 'closed')
            return 0;
        
        return this.#strategyHWM - this.#queueTotalSize;
    }

    private get shouldCallPull() {
        if (!this.canCloseOrEnqueue)
            return false;

        if (!this.#started)
            return false;

        if (this.#stream.locked && this.#stream[K_READER][K_READ_REQUEST_SIZE] > 0)
            return true;
        
        assert(() => this.desiredSize !== null);
        return this.desiredSize > 0;
    }

    private async pullIfNeeded() {
        if (!this.shouldCallPull)
            return;

        if (this.#pulling) {
            this.#pullAgain = true;
            return;
        }

        assert(() => !this.#pullAgain);
        this.#pulling = true;

        try {
            await this.#pullCallback(this);
            this.#pulling = false;
            if (this.#pullAgain) {
                this.#pullAgain = false;
                this.pullIfNeeded();
            }
        } catch (e) {
            this.handleError(e);
        }


    }
    
    [K_PULL_STEPS](readRequest : ReadRequest) {
        if (this.#queue.length > 0) {
            let chunk = this.dequeueValue();
            if (this.#closeRequested && this.#queue.length === 0) {
                this.#pullCallback = undefined;
                this.#cancelCallback = undefined;
                this.#stream[K_CLOSE]();
            } else {
                this.pullIfNeeded();
            }

            readRequest.chunk(chunk);
        } else {
            (<AltReadableStreamDefaultReader>this.#stream[K_READER])[K_READ_REQUESTS].push(readRequest);
            this.pullIfNeeded();
        }
    }
}

export class AltReadableStreamBYOBReader implements ReadableStreamBYOBReader {
    constructor(
        stream : ReadableStream
    ) {
        if (!(stream instanceof AltReadableStream))
            throw new TypeError(`Incompatible stream`);
        
        if (stream.locked)
            throw new TypeError(`ReadableStreamBYOBReader constructor can only accept readable streams that are not yet locked to a reader`);
        
        // TODO: 2. If stream.[[controller]] does not implement ReadableByteStreamController, throw a TypeError exception.
        // https://streams.spec.whatwg.org/#set-up-readable-stream-byob-reader

        //////////////////////////////////////////////////////////////////////////////
        // https://streams.spec.whatwg.org/#readable-stream-reader-generic-initialize
        this.#stream = <AltReadableStream>stream;
        stream[K_READER] = this;
        this.#closedResolve = this.#closedReject = () => {}
        if (stream[K_STATE] === 'readable') {
            this.#closed = new Promise((rs, rj) => (this.#closedResolve = rs, this.#closedReject = rj));
        } else if (stream[K_STATE] === 'closed') {
            this.#closed = Promise.resolve();
        } else if (stream[K_STATE] === 'errored') {
            this.#closed = Promise.reject(stream[K_STORED_ERROR]);
        } else {
            throw new TypeError(`ReadableStream is in an unknown state`);
        }
        //////////////////////////////////////////////////////////////////////////////
        
        this.#readIntoRequests = [];
    }

    #stream : AltReadableStream;
    #closed : Promise<void>;
    #closedResolve : () => void;
    #closedReject : (error) => void;
    #readIntoRequests : ReadIntoRequest[];

    get closed(): Promise<void> { return this.#closed; }
    get [K_READ_REQUEST_SIZE]() { return this.#readIntoRequests.length; }
    get [K_READ_INTO_REQUESTS]() { return this.#readIntoRequests; }

    async [K_ON_CLOSE](error?) {
        if (error)
            this.#closedReject(error), this.#readIntoRequests.forEach(r => r.error(error));
        else
            this.#closedResolve();
    }

    async cancel(reason?: any): Promise<void> {
        if (!this.#stream)
            throw new TypeError(`Cannot cancel a ReadableStreamBYOBReader which has no ReadableStream`);
        
        return await this.#stream.cancel(reason);
    }

    async read<T extends ArrayBufferView>(view: T): Promise<ReadableStreamReadResult<T>> {
        if (view.byteLength === 0)
            throw new TypeError(`Cannot use a zero-length array view for read()`);
        if (view.buffer.byteLength === 0)
            throw new TypeError(`Cannot use a zero-length array buffer for read()`);
        
        if (!this.#stream)
            throw new TypeError(`Cannot read when no stream is attached`);
        
        let resolve, reject;
        let promise = new Promise<ReadableStreamReadResult<T>>((rs, rj) => (resolve = rs, reject = rj));
        let request : ReadIntoRequest = {
            chunk: chunk => resolve([ chunk, false ]),
            close: chunk => resolve([ chunk, true ]),
            error: e => reject(e)
        };

        // https://streams.spec.whatwg.org/#readable-stream-byob-reader-read
        this.#stream[K_DISTURBED] = true;
        if (this.#stream[K_STATE] === 'errored')
            request.error(this.#stream[K_STORED_ERROR]);

        this.#stream[K_CONTROLLER][K_PULL_INTO](view, request);
        return promise;
    }

    releaseLock(): void {
        if (!this.#stream)
            return;
        if (this.#readIntoRequests.length > 0)
            throw new TypeError();
        assert(() => this.#stream[K_READER] === this);
        if (this.#stream[K_STATE] === 'readable')
            this.#closedReject(new TypeError());
        else
            this.#closed = Promise.reject(new TypeError());
        this.#stream[K_READER] = undefined;
        this.#stream = undefined;
    }
}

export class AltReadableStreamDefaultReader<R = any> implements ReadableStreamDefaultReader<R> {
    constructor(
        stream : ReadableStream
    ) { 
        if (!(stream instanceof AltReadableStream))
            throw new TypeError(`Incompatible stream`);
        
        if (stream.locked)
            throw new TypeError(`ReadableStreamDefaultReader constructor can only accept readable streams that are not yet locked to a reader`);
        
        // https://streams.spec.whatwg.org/#readable-stream-reader-generic-initialize
        this.#stream = <AltReadableStream>stream;
        stream[K_READER] = this;
        this.#closedResolve = this.#closedReject = () => {}
        if (stream[K_STATE] === 'readable') {
            this.#closed = new Promise((rs, rj) => (this.#closedResolve = rs, this.#closedReject = rj));
        } else if (stream[K_STATE] === 'closed') {
            this.#closed = Promise.resolve();
        } else if (stream[K_STATE] === 'errored') {
            this.#closed = Promise.reject(stream[K_STORED_ERROR]);
        } else {
            throw new TypeError(`ReadableStream is in an unknown state`);
        }
    }

    #stream : AltReadableStream;
    #closed : Promise<void>;
    #closedResolve : () => void;
    #closedReject : (error) => void;
    #readRequests : ReadRequest[];

    get closed(): Promise<void> { return this.#closed; }
    get [K_READ_REQUEST_SIZE]() { return this.#readRequests.length; }
    get [K_READ_REQUESTS]() { return this.#readRequests; }

    async [K_ON_CLOSE](error?) {
        if (error)
            this.#closedReject(error), this.#readRequests.forEach(r => r.error(error));
        else
            this.#closedResolve(), this.#readRequests.forEach(r => r.close());
    }

    async cancel(reason?: any): Promise<void> {
        if (!this.#stream)
            throw new TypeError(`Cannot cancel a ReadableStreamBYOBReader which has no ReadableStream`);
        
        return await this.#stream.cancel(reason);
    }

    async read(): Promise<ReadableStreamReadResult<any>> {
        if (!this.#stream)
            throw new TypeError();
        
        return new Promise<ReadableStreamReadResult<any>>((resolve, reject) => {
            let request : ReadRequest = {
                chunk: chunk => resolve({ value: chunk, done: false }),
                close: () => resolve({ value: undefined, done: true }),
                error: e => reject(e)
            };
            
            this.#stream[K_DISTURBED] = true;
            if (this.#stream[K_STATE] === 'closed') {
                request.close();
                return;
            }

            if (this.#stream[K_STATE] === 'errored') {
                request.error(this.#stream[K_STORED_ERROR]);
                return;
            }

            assert(() => this.#stream[K_STATE] === 'readable');
            this.#stream[K_CONTROLLER][K_PULL_STEPS](request);
        });
    }

    releaseLock(): void {
        if (!this.#stream)
            return;
        if (this.#readRequests.length > 0)
            throw new TypeError();
        
        assert(() => this.#stream[K_READER] === this);
        if (this.#stream[K_STATE] === 'readable')
            this.#closedReject(new TypeError());
        else
            this.#closed = Promise.reject(new TypeError());

        this.#stream[K_READER] = undefined;
        this.#stream = undefined;
    }

    [K_FULFILL_REQUEST](chunk : ArrayBufferView, done : boolean) {
        assert(() => this.#readRequests.length > 0);
        let readRequest = this.#readRequests.shift();
        if (done)
            readRequest.close();
        else
            readRequest.chunk(chunk);
    }

}

export class AltReadableStream<T = any> implements ReadableStream<T> {
    constructor(
        underlyingSource : UnderlyingSource = null,
        queuingStrategy? : QueuingStrategy
    ) {
        if (underlyingSource && 'type' in underlyingSource && underlyingSource.type !== 'bytes')
            throw new Error(`Invalid 'type' specified in underlyingSource`);

        if (underlyingSource?.type === 'bytes') {
            if (queuingStrategy && 'size' in queuingStrategy)
                throw new RangeError();
            
            let highWaterMark = queuingStrategy?.highWaterMark ?? 0;
            if (Number.isNaN(highWaterMark) || highWaterMark < 0)
                throw new RangeError();

            this.#controller = AltReadableByteStreamController[K_FROM_UNDERLYING_SOURCE](
                this, <UnderlyingByteSource>underlyingSource, highWaterMark
            );
            // TODO
        } else {
            let highWaterMark = queuingStrategy?.highWaterMark ?? 1;
            if (Number.isNaN(highWaterMark) || highWaterMark < 0)
                throw new RangeError();
            let sizeAlgorithm : QueuingStrategySizeCallback = chunk => 1;

            if (queuingStrategy?.size)
                sizeAlgorithm = chunk => queuingStrategy.size(chunk);

            this.#controller = AltReadableStreamDefaultController[K_FROM_UNDERLYING_SOURCE](
                this, underlyingSource, sizeAlgorithm, highWaterMark
            );
        }
    }

	#reader : AltReadableStreamBYOBReader | AltReadableStreamDefaultReader = null;
    #controller : AltReadableStreamDefaultController | AltReadableByteStreamController
    #disturbed = false;
    #state : 'closed' | 'errored' | 'readable' = 'readable';
    #storedError : Error;

	get locked(): boolean { return !!this.#reader; }
    set [K_DISTURBED](value) { this.#disturbed = value; }

	async cancel(reason?: any): Promise<void> {
		this.#disturbed = true;
        
        if (this.#state === 'closed')
            return;

        if (this.#state === 'errored')
            throw this.#storedError;
        
        await this[K_CLOSE]();

        if (this.#reader && this.#reader instanceof AltReadableStreamBYOBReader) {

        }
	}

    async [K_CLOSE](error?) {
        assert(() => this.#state === 'readable');
        this.#storedError = error;
        this.#state = 'closed';
        if (this.#reader)
            this.#reader[K_ON_CLOSE](error);
    }

    set [K_READER](reader) { this.#reader = reader; }
    get [K_READER]() { return this.#reader; }
    get [K_STATE]() { return this.#state; }
    get [K_STORED_ERROR]() { return this.#storedError; }
    get [K_CONTROLLER]() { return this.#controller; }
    set [K_CONTROLLER](value) { this.#controller = value; }

	getReader(options: { mode: 'byob'; }): ReadableStreamBYOBReader;
	getReader(): ReadableStreamDefaultReader<T>;
	getReader(options?: any): any {
        if (options.mode === 'byob')
            return new AltReadableStreamBYOBReader(this);
        else
            return new AltReadableStreamDefaultReader<T>(this);
	}

	pipeThrough<U>(transform: { writable: WritableStream<T>; readable: ReadableStream<U>; }, options?: PipeOptions): ReadableStream<U> {
        throw new Error('Method not implemented.');
	}

	pipeTo(dest: WritableStream<T>, options?: PipeOptions): Promise<void> {
		throw new Error('Method not implemented.');
	}

	tee(): [ReadableStream<T>, ReadableStream<T>] {
		throw new Error('Method not implemented.');
	}
}