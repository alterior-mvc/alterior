import { PromiseController } from "./promise-controller";
import { assert, ValueWithSize } from "./util";

const K_RESOLVE_READY = Symbol(`[[resolveReady]]`);
const K_STATE = Symbol(`[[state]]`);
const K_STREAM = Symbol(`[[stream]]`);
const K_WRITER = Symbol(`[[writer]]`);
const K_CONTROLLER = Symbol(`[[controller]]`);
const K_DESIRED_SIZE = Symbol(`[[desiredSize]]`);
const K_SIGNAL_CONTROLLER = Symbol(`[[signalController]]`);
const K_STORED_ERROR = Symbol(`[[storedError]]`);
const K_ENSURE_READY_PROMISE_REJECTED = Symbol(`[[ensureReadyPromiseRejected]]`);
const K_HAS_OPERATION_MARKED_IN_FLIGHT = Symbol(`[[hasOperationMarkedInFlight]]`);
const K_FINISH_ERRORING = Symbol(`[[finishErroring]]`);
const K_ERROR_STEPS = Symbol(`[[errorSteps]]`);
const K_READY = Symbol(`[[ready]]`);
const K_CLOSE = Symbol(`[[close]]`);
const K_WRITE = Symbol(`[[write]]`);
const K_CLOSED = Symbol(`[[closed]]`);
const K_IN_FLIGHT_WRITE_REQUEST = Symbol(`[[inFlightWriteRequest]]`);
const K_IN_FLIGHT_CLOSE_REQUEST = Symbol(`[[inFlightCloseRequest]]`);
const K_MARK_CLOSE_REQUEST_IN_FLIGHT = Symbol(`[[markCloseRequestInFlight]]`);
const K_FINISH_IN_FLIGHT_CLOSE = Symbol(`[[finishInFlightClose]]`);
const K_FINISH_IN_FLIGHT_CLOSE_WITH_ERROR = Symbol(`[[finishInFlightCloseWithError]]`);
const K_MARK_FIRST_WRITE_REQUEST_IN_FLIGHT = Symbol(`[[markFirstWriteRequestInFlight]]`);
const K_FINISH_IN_FLIGHT_WRITE = Symbol(`[[finishInFlightWrite]]`);
const K_CLOSE_QUEUED_OR_IN_FLIGHT = Symbol(`[[closeQueuedOrInFlight]]`);
const K_UPDATE_BACKPRESSURE = Symbol(`[[updateBackpressure]]`);
const K_FINISH_IN_FLIGHT_WRITE_WITH_ERROR = Symbol(`[[finishInFlightWriteWithError]]`);
const K_START_ERRORING = Symbol(`[[startErroring]]`);
const K_STARTED = Symbol(`[[started]]`);
const K_ADD_WRITE_REQUEST = Symbol(`[[addWriteRequest]]`);
const K_CHUNK_SIZE = Symbol(`[[chunkSize]]`);
const K_NEW = Symbol(`[[new]]`);
const K_FROM_UNDERLYING_SINK = Symbol(`[[fromUnderlyingSink]]`);

const CLOSE_SENTINEL : ValueWithSize = { value: undefined, size: 0 };

interface PendingAbortRequest {
    promise : PromiseController;
    reason;
    wasAlreadyErroring : boolean;
}

export class AltWritableStreamDefaultController implements WritableStreamDefaultController {
    private constructor() {
        this.#signalController = new AbortController();
        this.#signal = this.#signalController.signal;
    }

    static [K_NEW]() {
        return new AltWritableStreamDefaultController();
    }

    static [K_FROM_UNDERLYING_SINK](
        stream : AltWritableStream,
        underlyingSink : UnderlyingSink,
        sizeAlgorithm : QueuingStrategySizeCallback,
        highWaterMark : number
    ) {

    }

    #strategyHWM : number;
    #queue : ValueWithSize[] = [];
    #queueTotalSize = 0;
    #signal : AbortSignal;
    #signalController : AbortController;
    #stream : AltWritableStream;
    #started = false;

    #writeAlgorithm;
    #closeAlgorithm;
    #abortAlgorithm;
    #strategySizeAlgorithm;

    get [K_SIGNAL_CONTROLLER]() { return this.#signalController; }
    get [K_STARTED]() { return this.#started; }
    get [K_STREAM]() { return this.#stream; }
    set [K_STREAM](value) { this.#stream = value; }
    get signal() { return this.#signal; }

    error(error?: any): void {
        if (this.#stream[K_STATE] !== 'writable')
            return;
        this.#writeAlgorithm = undefined;
        this.#closeAlgorithm = undefined;
        this.#abortAlgorithm = undefined;
        this.#strategySizeAlgorithm = undefined;
        assert(() => !this.#stream[K_STORED_ERROR]);
        assert(() => this.#stream[K_STATE] === 'writable');
        assert(() => !!this.#stream[K_CONTROLLER]);

        this.#stream[K_STATE] = 'erroring';
        this.#stream[K_STORED_ERROR] = error;
        if (this.#stream[K_WRITER])
            this.#stream[K_WRITER][K_ENSURE_READY_PROMISE_REJECTED](error);

        if (!this.#stream[K_HAS_OPERATION_MARKED_IN_FLIGHT] && this.#started) {
            this.#stream[K_FINISH_ERRORING]();
        }
    }

    get [K_DESIRED_SIZE]() {
        return this.#strategyHWM - this.#queueTotalSize;
    }

    [K_ERROR_STEPS]() {
        this.#queue = [];
        this.#queueTotalSize = 0;
    }

    [K_CLOSE]() {
        this.enqueueValueWithSize(CLOSE_SENTINEL, 0);
        this.advanceQueueIfNeeded();
    }

    [K_WRITE](chunk, chunkSize : number) {
        try {
            this.enqueueValueWithSize(chunk, chunkSize)
        } catch (e) {
            this.errorIfNeeded(e);
            return;
        }

        if (!this.#stream[K_CLOSE_QUEUED_OR_IN_FLIGHT] && this.#stream[K_STATE] === 'writable') {
            this.#stream[K_UPDATE_BACKPRESSURE](this.backpressure);
        }

        this.advanceQueueIfNeeded();
    }

    private advanceQueueIfNeeded() {
        if (!this.#started)
            return;
        if (this.#stream[K_IN_FLIGHT_WRITE_REQUEST])
            return;
        
        assert(() => !['closed', 'errored'].includes(this.#stream[K_STATE]));
        if (this.#stream[K_STATE] === 'erroring') {
            this.#stream[K_FINISH_ERRORING]();
            return;
        }

        if (this.#queue.length === 0)
            return;

        let value = this.peekQueueValue();

        if (value === CLOSE_SENTINEL) {
            this.processClose();
        } else {
            this.processWrite(value);
        }
    }

    private async processClose() {
        this.#stream[K_MARK_CLOSE_REQUEST_IN_FLIGHT]();
        this.dequeueValue();
        assert(() => this.#queue.length === 0);

        try {
            await this.#closeAlgorithm();
            this.#stream[K_FINISH_IN_FLIGHT_CLOSE]();
        } catch (e) {
            this.#stream[K_FINISH_IN_FLIGHT_CLOSE_WITH_ERROR](e);
        }
    }

    private async processWrite(chunk) {
        this.#stream[K_MARK_FIRST_WRITE_REQUEST_IN_FLIGHT]();
        try {
            await this.#writeAlgorithm(chunk);
        } catch (e) {
            if (this.#stream[K_STATE] === 'writable') {
                this.#abortAlgorithm = undefined;
                this.#closeAlgorithm = undefined;
                this.#writeAlgorithm = undefined;
            }

            this.#stream[K_FINISH_IN_FLIGHT_WRITE_WITH_ERROR](e);
            return;
        }
        
        this.#stream[K_FINISH_IN_FLIGHT_WRITE]();
        assert(() => ['writable', 'erroring'].includes(this.#stream[K_STATE]));
        this.dequeueValue();
        if (!this.#stream[K_CLOSE_QUEUED_OR_IN_FLIGHT]() && this.#stream[K_STATE] === 'writable') {
            this.#stream[K_UPDATE_BACKPRESSURE](this.backpressure);
        }

        this.advanceQueueIfNeeded();
    }

    private get backpressure() {
        return this[K_DESIRED_SIZE] <= 0;
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

    [K_CHUNK_SIZE](chunk) {
        try {
            return this.#strategySizeAlgorithm(chunk);
        } catch (e) {
            this.errorIfNeeded(e);
        }
    }

    private errorIfNeeded(error) {
        if (this.#stream[K_STATE] === 'writable')
            this.error(error);
    }

}

export class AltWritableStreamDefaultWriter<W = any> implements WritableStreamDefaultWriter<W> {
    #closed : PromiseController<void>;
    #ready : PromiseController<void>;
    #stream : AltWritableStream;

    get closed(): Promise<void> { return this.#closed.promise; }
    get [K_CLOSED]() { return this.#closed; }
    set [K_CLOSED](value) { this.#closed = value; }

    get desiredSize(): number {
        if (!this.#stream)
            throw new TypeError();
        
        if (['errored', 'erroring'].includes(this.#stream[K_STATE]))
            return null;
        if (this.#stream[K_STATE] === 'closed')
            return 0;

            this.#stream.close
        return this.#stream[K_CONTROLLER][K_DESIRED_SIZE];
    }

    get ready(): Promise<void> { return this.#ready.promise; }

    abort(reason?: any): Promise<void> {
        throw new Error("Method not implemented.");
    }
    
    close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    
    releaseLock(): void {
        throw new Error("Method not implemented.");
    }
    
    async write(chunk: W): Promise<void> {
        if (!this.#stream)
            throw new TypeError();

        let chunkSize = this.#stream[K_CONTROLLER][K_CHUNK_SIZE](chunk);
        if (this.#stream[K_WRITER] !== this)
            throw new TypeError();

        if (this.#stream[K_STATE] === 'errored')
            throw this.#stream[K_STORED_ERROR];
        if (this.#stream[K_CLOSE_QUEUED_OR_IN_FLIGHT]() || this.#stream[K_STATE] === 'closed')
            throw new TypeError(`The stream is closing or already closed`);
        if (this.#stream[K_STATE] === 'erroring')
            throw this.#stream[K_STORED_ERROR];
        
        assert(() => this.#stream[K_STATE] === 'writable');
        let promise = this.#stream[K_ADD_WRITE_REQUEST]();
        this.#stream[K_CONTROLLER][K_WRITE](chunk, chunkSize);
        return promise.promise;
    }

    get [K_READY]() { return this.#ready; }
    set [K_READY](value) { this.#ready = value; }

    [K_ENSURE_READY_PROMISE_REJECTED](error) {
        if (this.#ready.state === 'pending')
            this.#ready.reject(error);
        else
            this.#ready = PromiseController.reject(error);
    }
}

export class AltWritableStream<W = any> implements WritableStream<W> {
    constructor(underlyingSink : UnderlyingSink = null, strategy : QueuingStrategy = null) {
        if ('type' in underlyingSink)
            throw new RangeError();
        let sizeAlgorithm = strategy?.size ? chunk => strategy.size(chunk) : () => 1;
        let highWaterMark : number = 1;
        
        if ('highWaterMark' in strategy) 
            highWaterMark = strategy.highWaterMark;

        if (Number.isNaN(highWaterMark) || highWaterMark < 0)
            throw new RangeError();
        
        assert(() => !this.#controller);

        let controller = AltWritableStreamDefaultController[K_NEW]();
        this.#controller = controller;
        controller[K_STREAM] = this;

        let startAlgorithm = () => {};
        let writeAlgorithm = chunk => Promise.resolve();
        let closeAlgorithm = () => Promise.resolve();
        let abortAlgorithm = error => Promise.resolve();

        if (underlyingSink.start)
            startAlgorithm = () => underlyingSink.start.call(underlyingSink, controller);
        if (underlyingSink.write)
            writeAlgorithm = chunk => underlyingSink.write.call(underlyingSink, chunk, controller);
        if (underlyingSink.close)
            closeAlgorithm = () => underlyingSink.close.call(underlyingSink);
        if (underlyingSink.abort)
            abortAlgorithm = error => underlyingSink.abort.call(underlyingSink, error);
        
        
    }

    #backpressure = false;
    #closeRequest : PromiseController<void>;
    #controller : AltWritableStreamDefaultController;
    #inFlightWriteRequest : PromiseController<void>;
    #inFlightCloseRequest : PromiseController<void>;
    #state : 'closed' | 'errored' | 'erroring' | 'writable' = 'writable';
    #storedError;
    #pendingAbortRequest : PendingAbortRequest;
    #writer : AltWritableStreamDefaultWriter;
    #writeRequests : PromiseController<void>[] = [];

    get locked(): boolean {
        return !!this.#writer;
    }

    async abort(reason?: any): Promise<void> {
        if (this.locked)
            throw new TypeError();
        
        if (['closed', 'errored'].includes(this.#state))
            return;
        
        this.#controller[K_SIGNAL_CONTROLLER].abort();
    }

    getWriter(): WritableStreamDefaultWriter<W> {
        throw new Error("Method not implemented.");
    }

    async close() {
        if (!this.locked)
            throw new TypeError();
        if (this.closeQueuedOrInFlight)
            throw new TypeError();
        
        if (['closed', 'errored'].includes(this.#state))
            throw new TypeError();
        
        assert(() => ['writable', 'erroring'].includes(this.#state));

        this.#closeRequest = new PromiseController<void>();

        if (this.#writer && this.#backpressure && this.#state === 'writable')
            this.#writer[K_READY].resolve();

        this.#controller[K_CLOSE]();
    }

    private get closeQueuedOrInFlight() {
        return !!(this.#closeRequest || this.#inFlightCloseRequest);
    }

    get [K_STATE]() { return this.#state; }
    set [K_STATE](value) { this.#state = value; }
    get [K_WRITER]() { return this.#writer; }
    get [K_CONTROLLER]() { return this.#controller; }
    get [K_STORED_ERROR]() { return this.#storedError; }
    set [K_STORED_ERROR](value) { this.#storedError = value; }
    get [K_IN_FLIGHT_WRITE_REQUEST]() { return this.#inFlightWriteRequest; }
    get [K_IN_FLIGHT_CLOSE_REQUEST]() { return this.#inFlightCloseRequest; }

    get [K_HAS_OPERATION_MARKED_IN_FLIGHT]() {
        return !!(this.#inFlightWriteRequest || this.#inFlightCloseRequest);
    }

    [K_FINISH_ERRORING]() {
        assert(() => this.#state === 'erroring');
        assert(() => !this[K_HAS_OPERATION_MARKED_IN_FLIGHT]);
        this.#state = 'errored';
        this.#controller[K_ERROR_STEPS]();
        for (let request of this.#writeRequests) {
            request
        }
    }

    [K_MARK_CLOSE_REQUEST_IN_FLIGHT]() {
        assert(() => !this.#inFlightCloseRequest);
        assert(() => !this.#closeRequest);
        this.#inFlightCloseRequest = this.#closeRequest;
        this.#closeRequest = undefined;
    }

    [K_FINISH_IN_FLIGHT_CLOSE]() {
        assert(() => !!this.#inFlightCloseRequest)
        this.#inFlightCloseRequest.resolve();
        this.#inFlightCloseRequest = undefined;
        assert(() => ['writable', 'erroring'].includes(this.#state));
        if (this.#state === 'erroring') {
            this.#storedError = undefined;
            if (this.#pendingAbortRequest) {
                this.#pendingAbortRequest.promise.resolve();
                this.#pendingAbortRequest = undefined;
            }
        }

        this.#state = 'closed';
        if (this.#writer)
            this.#writer[K_CLOSED].resolve();
        assert(() => !this.#pendingAbortRequest);
        assert(() => !this.#storedError);
    }

    [K_FINISH_IN_FLIGHT_CLOSE_WITH_ERROR](error?) {
        assert(() => !!this.#inFlightCloseRequest);
        this.#inFlightCloseRequest.reject(error);
        this.#inFlightCloseRequest = undefined;
        assert(() => ['writable', 'erroring'].includes(this.#state));
        if (this.#pendingAbortRequest) {
            this.#pendingAbortRequest.promise.reject(error);
            this.#pendingAbortRequest = undefined;
        }

        if (this.#state === 'writable') {
            this[K_START_ERRORING](error);
            return;
        }

        assert(() => this.#state === 'erroring');
        this[K_FINISH_ERRORING]();
    }

    [K_MARK_FIRST_WRITE_REQUEST_IN_FLIGHT]() {
        assert(() => !!this.#inFlightWriteRequest);
        assert(() => this.#writeRequests.length > 0);
        this.#inFlightWriteRequest = this.#writeRequests.shift();
    }

    [K_FINISH_IN_FLIGHT_WRITE]() {
        assert(() => !!this.#inFlightWriteRequest);
        this.#inFlightWriteRequest.resolve();
        this.#inFlightWriteRequest = undefined;
    }

    [K_CLOSE_QUEUED_OR_IN_FLIGHT]() {
        return this.closeQueuedOrInFlight;
    }

    [K_UPDATE_BACKPRESSURE](backpressure) {
        assert(() => this.#state === 'writable');
        assert(() => !this.closeQueuedOrInFlight);
        if (this.#writer && this.#backpressure !== backpressure) {
            if (backpressure) {
                this.#writer[K_READY] = new PromiseController();
            } else {
                assert(() => !backpressure);
                this.#writer[K_READY].resolve();
            }
        }

        this.#backpressure = backpressure;
    }

    [K_FINISH_IN_FLIGHT_WRITE_WITH_ERROR](error) {
        assert(() => !!this.#inFlightWriteRequest);
        this.#inFlightWriteRequest.reject(error);
        this.#inFlightWriteRequest = undefined;
        assert(() => ['writable', 'erroring'].includes(this.#state));

        if (this.#state === 'writable') {
            this[K_START_ERRORING](error);
            return;
        }

        assert(() => this.#state === 'erroring');
        this[K_FINISH_ERRORING]();
    }

    [K_START_ERRORING](error) {
        assert(() => !this.#storedError);
        assert(() => this.#state === 'writable');
        assert(() => !!this.#controller);
        this.#state = 'erroring';
        this.#storedError = error;
        if (this.#writer)
            this.#writer[K_ENSURE_READY_PROMISE_REJECTED](error);
        if (!this[K_HAS_OPERATION_MARKED_IN_FLIGHT] && this.#controller[K_STARTED])
            this[K_FINISH_ERRORING]();
    }

    [K_ADD_WRITE_REQUEST]() {
        assert(() => this.locked)
        assert(() => this.#state === 'writable');
        let promise = new PromiseController();
        this.#writeRequests.push(promise);
        return promise;
    }
}