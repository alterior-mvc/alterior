
export const READER = Symbol(`[[reader]]`);
export const STATE = Symbol(`[[state]]`);
export const STREAM = Symbol(`[[stream]]`);
export const CLOSED = Symbol(`[[closed]]`);
export const STORED_ERROR = Symbol(`[[storedError]]`);
export const DISTURBED = Symbol('[[disturbed]]');
export const CONTROLLER = Symbol(`[[controller]]`);
export const PULL_STEPS = Symbol(`[[pullSteps]]`);
export const CANCEL_STEPS = Symbol(`[[cancelSteps]]`);
export const VIEW = Symbol(`[[view]]`);
export const FROM_VIEW = Symbol(`[[fromView]]`);
export const READ_REQUEST_SIZE = Symbol(`[[readRequestSize]]`);
export const READ_REQUESTS = Symbol(`[[readRequests]]`);
export const READ_INTO_REQUESTS = Symbol(`[[readIntoRequests]]`);
export const CLOSE_REQUESTED = Symbol(`[[closeRequested]]`);
export const CLOSE_REQUEST = Symbol(`[[closeRequest]]`);
export const STRATEGY_HWM = Symbol(`[[strategyHWM]]`);
export const PENDING_PULL_INTOS = Symbol(`[[pendingPullIntos]]`);
export const PENDING_ABORT_REQUEST = Symbol(`[[pendingAbortRequest]]`);
export const ABORT_STEPS = Symbol(`[[abortSteps]]`);
export const WRITE_REQUESTS = Symbol(`[[writeRequests]]`);
export const BYOB_REQUEST = Symbol(`[[byobRequest]]`);
export const CANCEL_ALGORITHM = Symbol(`[[cancelAlgorithm]]`);
export const PULL_ALGORITHM = Symbol(`[[pullAlgorithm]]`);
export const AUTO_ALLOCATE_CHUNK_SIZE = Symbol(`[[autoAllocateChunkSize]]`);
export const STRATEGY_SIZE_ALGORITHM = Symbol(`[[strategySizeAlgorithm]]`);
export const STARTED = Symbol(`[[started]]`);
export const PULL_AGAIN = Symbol(`[[pullAgain]]`);
export const PULLING = Symbol(`[[pulling]]`);
export const QUEUE_TOTAL_SIZE = Symbol(`[[queueTotalSize]]`);
export const QUEUE = Symbol(`[[queue]]`);
export const RESOLVE_READY = Symbol(`[[resolveReady]]`);
export const WRITER = Symbol(`[[writer]]`);
export const DESIRED_SIZE = Symbol(`[[desiredSize]]`);
export const SIGNAL_CONTROLLER = Symbol(`[[signalController]]`);
export const SIGNAL = Symbol(`[[signal]]`);
export const ERROR_STEPS = Symbol(`[[errorSteps]]`);
export const READY = Symbol(`[[ready]]`);
export const CLOSE = Symbol(`[[close]]`);
export const WRITE = Symbol(`[[write]]`);
export const IN_FLIGHT_WRITE_REQUEST = Symbol(`[[inFlightWriteRequest]]`);
export const IN_FLIGHT_CLOSE_REQUEST = Symbol(`[[inFlightCloseRequest]]`);
export const BACKPRESSURE = Symbol(`[[backpressure]]`);

export const WRITE_ALGORITHM = Symbol(`[[writeAlgorithm]]`);
export const CLOSE_ALGORITHM = Symbol(`[[closeAlgorithm]]`);
export const ABORT_ALGORITHM = Symbol(`[[abortAlgorithm]]`);

export const NEW = Symbol(`[[new]]`);

export const READABLE = Symbol(`[[readable]]`);
export const WRITABLE = Symbol(`[[writable]]`);
export const BACKPRESSURE_CHANGE_PROMISE = Symbol(`[[backpressureChangePromise]]`);

export const TRANSFORM_ALGORITHM = Symbol(`[[transformAlgorithm]]`);
export const FLUSH_ALGORITHM = Symbol(`[[flushAlgorithm]]`);