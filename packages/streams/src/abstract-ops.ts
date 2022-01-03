import { AltReadableByteStreamController, AltReadableStream, AltReadableStreamBYOBReader, 
    AltReadableStreamDefaultController, AltReadableStreamDefaultReader, 
    AltReadableStreamBYOBRequest } from './readable-stream';
import { React, assert, CopyDataBlockBytes, DequeueValue, EnqueueValueWithSize, PeekQueueValue, ResetQueue, Catch, Resolve, All, RethrowAssertionErrorRejection, SetPromiseIsHandledToTrue, Loop, Reject, RejectHandled } from './util';
import * as K from './symbols';
import { PromiseController } from './promise-controller';
import { PullIntoDescriptor, ReadIntoRequest, ReadRequest } from './types';
import { AltWritableStream, AltWritableStreamDefaultController, AltWritableStreamDefaultWriter } from './writable-stream';
import { CLOSE_SENTINEL } from './close-sentinel';
import { AltAbortController, AltAbortSignal } from 'abort-controller';
import { AltTransformStream, AltTransformStreamDefaultController } from './transform-stream';

export function isBYOBReader(reader) {
    if (reader instanceof AltReadableStreamBYOBReader)
        return true;
    else if (typeof ReadableStreamBYOBReader !== 'undefined' && reader instanceof AltReadableStreamBYOBReader)
        return true;

    return false;
}

export function isDefaultReader(reader) {
    if (reader instanceof AltReadableStreamDefaultReader)
        return true;
    else if (typeof ReadableStreamDefaultReader !== 'undefined' && reader instanceof AltReadableStreamDefaultReader)
        return true;
    
    return false;
}

export function ReadableStreamHasBYOBReader(stream : AltReadableStream) {
    return isBYOBReader(stream[K.READER]);
}

export function ReadableStreamHasDefaultReader(stream : AltReadableStream) {
    return isDefaultReader(stream[K.READER]);
}

export function ReadableByteStreamControllerGetDesiredSize(controller : AltReadableByteStreamController) {
    let state = controller[K.STREAM][K.STATE];

    if (state === 'errored')
        return null;
    if (state === 'closed')
        return 0;
    
    return controller[K.STRATEGY_HWM] - controller[K.QUEUE_TOTAL_SIZE];
}

export function ReadableStreamDefaultControllerGetDesiredSize(controller : AltReadableStreamDefaultController) {
    let state = controller[K.STREAM][K.STATE];

    if (state === 'errored')
        return null;
    if (state === 'closed')
        return 0;

    return controller[K.STRATEGY_HWM] - controller[K.QUEUE_TOTAL_SIZE];
}

export function FulfillReadRequest(stream : AltReadableStream, chunk : ArrayBufferView, done : boolean) {
    assert(() => ReadableStreamHasDefaultReader(stream));
    let reader = <AltReadableStreamDefaultReader>stream[K.READER];

    assert(() => reader[K.READ_REQUESTS].length > 0);

    let readRequest = reader[K.READ_REQUESTS].shift();

    if (done)
        readRequest.close();
    else
        readRequest.chunk(chunk);
}

export function FulfillReadIntoRequest(stream : AltReadableStream, chunk : ArrayBufferView, done : boolean) {
    assert(() => ReadableStreamHasBYOBReader(stream));
    let reader = <AltReadableStreamBYOBReader>stream[K.READER];

    assert(() => reader[K.READ_INTO_REQUESTS].length > 0);

    let readRequest = reader[K.READ_INTO_REQUESTS].shift();

    if (done)
        readRequest.close(chunk);
    else
        readRequest.chunk(chunk);
}

export function ReadableByteStreamControllerError(controller : AltReadableByteStreamController, e) {
    if (controller[K.STREAM][K.STATE] !== 'readable')
            return;
    controller[K.PENDING_PULL_INTOS] = [];
    controller[K.QUEUE] = [];
    controller[K.QUEUE_TOTAL_SIZE] = 0;
    controller[K.PULL_ALGORITHM] = undefined;
    controller[K.CANCEL_ALGORITHM] = undefined;

    ReadableStreamError(controller[K.STREAM], e);
}

export function ReadableByteStreamControllerClearPendingPullIntos(controller : AltReadableByteStreamController) {
    controller[K.PENDING_PULL_INTOS] = [];
}

export function ReadableByteStreamControllerInvalidateBYOBRequest(controller : AltReadableByteStreamController) {
    if (!controller[K.BYOB_REQUEST])
        return;
    controller[K.BYOB_REQUEST][K.CONTROLLER] = null;
    controller[K.BYOB_REQUEST][K.VIEW] = null;
    controller[K.BYOB_REQUEST] = null;

}

export function ReadableByteStreamControllerClearAlgorithms(controller : AltReadableByteStreamController) {
    controller[K.PULL_ALGORITHM] = undefined;
    controller[K.CANCEL_ALGORITHM] = undefined;
}

export function ReadableByteStreamControllerClose(controller : AltReadableByteStreamController) {
    let stream = controller[K.STREAM];
    if (controller[K.CLOSE_REQUESTED] || stream[K.STATE] !== 'readable')
        return;

    if (controller[K.QUEUE_TOTAL_SIZE] > 0) {
        controller[K.CLOSE_REQUESTED] = true;
        return;
    }

    if (controller[K.PENDING_PULL_INTOS].length > 0) {
        let first = controller[K.PENDING_PULL_INTOS][0];
        if (first.bytesFilled > 0) {
            let e = new TypeError();
            ReadableByteStreamControllerError(controller, e);
            throw e;
        }
    }

    ReadableByteStreamControllerClearAlgorithms(controller);
    ReadableStreamClose(controller[K.STREAM]);
}

export function  ReadableStreamGetNumReadRequests(stream : AltReadableStream) {
    assert(() => ReadableStreamHasDefaultReader(stream));
    return (stream[K.READER] as AltReadableStreamDefaultReader)[K.READ_REQUESTS].length;
}

export function  ReadableStreamGetNumReadIntoRequests(stream : AltReadableStream) {
    assert(() => ReadableStreamHasBYOBReader(stream));
    return (stream[K.READER] as ReadableStreamBYOBReader)[K.READ_INTO_REQUESTS].length;
}

export function ReadableByteStreamControllerEnqueue(controller : AltReadableByteStreamController, chunk : ArrayBufferView) {
    let stream = controller[K.STREAM];
    if (controller[K.CLOSE_REQUESTED] || stream[K.STATE] !== 'readable')
        return;
    
    let buffer = chunk.buffer;
    let byteOffset = chunk.byteOffset;
    let byteLength = chunk.byteLength;

    ReadableByteStreamControllerInvalidateBYOBRequest(controller);
    if (ReadableStreamHasDefaultReader(stream)) {
        if (ReadableStreamGetNumReadRequests(stream) === 0) {
            assert(() => controller[K.PENDING_PULL_INTOS].length === 0);
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, buffer, byteOffset, byteLength);
        } else {
            assert(() => controller[K.QUEUE].length === 0);
            if (controller[K.PENDING_PULL_INTOS].length > 0) {
                assert(() => controller[K.PENDING_PULL_INTOS][0].readerType === 'default');
                ReadableByteStreamControllerShiftPendingPullInto(controller);
            }

            let chunk = new Uint8Array(buffer, byteOffset, byteLength);
            FulfillReadRequest(stream, chunk, false);
        }
    }
}

export function ReadableByteStreamControllerEnqueueChunkToQueue(
    controller : AltReadableByteStreamController, 
    buffer : ArrayBuffer, 
    byteOffset : number, 
    byteLength : number
) {
    controller[K.QUEUE].push({ buffer, byteLength, byteOffset });
    controller[K.QUEUE_TOTAL_SIZE] += byteLength;
}

export function ReadableByteStreamControllerShiftPendingPullInto(controller : AltReadableByteStreamController) {
    assert(() => !controller[K.BYOB_REQUEST]);
    return controller[K.PENDING_PULL_INTOS].shift();
}

export function ReadableByteStreamControllerCommitPullIntoDescriptor(
    stream : AltReadableStream, 
    descriptor : PullIntoDescriptor
) {
    assert(() => stream[K.STATE] !== 'errored');
    let done = false;
    if (stream[K.STATE] === 'closed') {
        assert(() => descriptor.bytesFilled === 0);
        done = true;
    }

    let filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(descriptor);

    if (descriptor.readerType === 'default') {
        FulfillReadRequest(stream, filledView, done);
    } else {
        assert(() => descriptor.readerType === 'byob');
        FulfillReadIntoRequest(stream, filledView, done);
    }
}

export function ReadableByteStreamControllerConvertPullIntoDescriptor(descriptor : PullIntoDescriptor) {
    assert(() => descriptor.bytesFilled <= descriptor.byteLength);
    assert(() => descriptor.bytesFilled % descriptor.elementSize === 0);
    
    // Probably not useful to implement:
    // https://streams.spec.whatwg.org/#transfer-array-buffer

    let ctor : any = descriptor.viewConstructor || Uint8Array;
    return <ArrayBufferView> new ctor(descriptor.buffer, descriptor.byteOffset, descriptor.bytesFilled / descriptor.elementSize);
}

export function ReadableByteStreamControllerRespondInClosedState(
    controller : AltReadableByteStreamController, 
    firstDescriptor : PullIntoDescriptor
) {
    assert(() => firstDescriptor.bytesFilled === 0);
    let stream = controller[K.STREAM];
    
    if (ReadableStreamHasBYOBReader(stream)) {
        while (ReadableStreamGetNumReadIntoRequests(stream) > 0) {
            let pullIntoDescriptor = ReadableByteStreamControllerShiftPendingPullInto(controller);
            ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor);
        }
    }
}

export function ReadableByteStreamControllerRespondInReadableState(
    controller : AltReadableByteStreamController, 
    bytesWritten : number, 
    descriptor : PullIntoDescriptor
) {
    assert(() => descriptor.bytesFilled + bytesWritten <= descriptor.byteLength);
    ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesWritten, descriptor);
    if (descriptor.bytesFilled < descriptor.elementSize)
        return;
    ReadableByteStreamControllerShiftPendingPullInto(controller);
    let remainderSize = descriptor.bytesFilled % descriptor.elementSize;
    if (remainderSize > 0) {
        let end = descriptor.byteOffset + descriptor.bytesFilled;
        let remainder = descriptor.buffer.slice(end - remainderSize, end);
        ReadableByteStreamControllerEnqueueChunkToQueue(controller, remainder, 0, remainder.byteLength);
    }

    descriptor.bytesFilled -= remainderSize;
    ReadableByteStreamControllerCommitPullIntoDescriptor(controller[K.STREAM], descriptor);
    ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
}

export function ReadableByteStreamControllerFillHeadPullIntoDescriptor(
    controller : AltReadableByteStreamController, 
    size : number, 
    descriptor : PullIntoDescriptor
) {
    assert(() => controller[K.PENDING_PULL_INTOS].length === 0 || controller[K.PENDING_PULL_INTOS][0] === descriptor);
    assert(() => !controller[K.BYOB_REQUEST]);
    descriptor.bytesFilled += size;
}

export function ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(
    controller : AltReadableByteStreamController
) {
    assert(() => !controller[K.CLOSE_REQUESTED]);

    while (controller[K.PENDING_PULL_INTOS].length > 0) {
        if (controller[K.QUEUE_TOTAL_SIZE] === 0)
            return;
        let pullIntoDescriptor = controller[K.PENDING_PULL_INTOS][0];

        if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
            ReadableByteStreamControllerShiftPendingPullInto(controller);
            ReadableByteStreamControllerCommitPullIntoDescriptor(controller[K.STREAM], pullIntoDescriptor);
        }
    }
}

export function ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(
    controller : AltReadableByteStreamController,
    descriptor : PullIntoDescriptor
): boolean {
    let elementSize = descriptor.elementSize;
    let currentAlignedBytes = descriptor.bytesFilled - (descriptor.bytesFilled % elementSize);
    let maxBytesToCopy = Math.min(controller[K.QUEUE_TOTAL_SIZE], descriptor.byteLength - descriptor.bytesFilled);
    let maxBytesFilled = descriptor.bytesFilled + maxBytesToCopy;
    let maxAlignedBytes = maxBytesFilled - (maxBytesFilled % elementSize);
    let totalBytesToCopyRemaining = maxBytesToCopy;
    let ready = false;
    if (maxAlignedBytes > currentAlignedBytes) {
        totalBytesToCopyRemaining = maxAlignedBytes - descriptor.bytesFilled;
        ready = true;
    }

    while (totalBytesToCopyRemaining > 0) {
        let headOfQueue = controller[K.QUEUE][0];
        let bytesToCopy = Math.min(totalBytesToCopyRemaining, headOfQueue.byteLength);
        let destStart = descriptor.byteOffset + descriptor.bytesFilled;
        CopyDataBlockBytes(descriptor.buffer, destStart, headOfQueue.buffer, headOfQueue.byteOffset, bytesToCopy);
        headOfQueue.byteOffset += bytesToCopy;
        headOfQueue.byteLength -= bytesToCopy;
        if (headOfQueue.byteLength <= 0)
            controller[K.QUEUE].shift();

        controller[K.QUEUE_TOTAL_SIZE] -= bytesToCopy;
        ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesToCopy, descriptor);
        totalBytesToCopyRemaining -= bytesToCopy;
    }

    if (!ready) {
        assert(() => controller[K.QUEUE_TOTAL_SIZE] === 0);
        assert(() => descriptor.bytesFilled > 0);
        assert(() => descriptor.bytesFilled < descriptor.elementSize);
    }

    return ready;
}


export function ReadableByteStreamControllerRespondInternal(
    controller : AltReadableByteStreamController, 
    bytesWritten : number
) {
    let first = controller[K.PENDING_PULL_INTOS][0];
    
    ReadableByteStreamControllerInvalidateBYOBRequest(controller);

    if (controller[K.STREAM][K.STATE] === 'closed') {
        assert(() => bytesWritten === 0);
        ReadableByteStreamControllerRespondInClosedState(controller, first);
    } else {
        assert(() => controller[K.STREAM][K.STATE] === 'readable');
        assert(() => bytesWritten > 0);
        ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, first);
    }
}


export function ReadableByteStreamControllerRespond(
    controller : AltReadableByteStreamController, 
    bytesWritten : number
) {
    assert(() => controller[K.PENDING_PULL_INTOS].length > 0);
    let firstDescriptor = controller[K.PENDING_PULL_INTOS][0];
    if (controller[K.STREAM][K.STATE] === 'closed' && bytesWritten !== 0)
        throw new TypeError();
    
    assert(() => controller[K.STREAM][K.STATE] === 'readable');
    if (bytesWritten === 0)
        throw new TypeError();
    if (firstDescriptor.bytesFilled + bytesWritten > firstDescriptor.byteLength)
        throw new RangeError();
    
    ReadableByteStreamControllerRespondInternal(controller, bytesWritten);
}

export function ReadableByteStreamControllerRespondWithNewView(
    controller : AltReadableByteStreamController, 
    view : ArrayBufferView
) {
    assert(() => controller[K.PENDING_PULL_INTOS].length > 0);
    let firstDescriptor = controller[K.PENDING_PULL_INTOS][0];
    
    assert(() => ['readable', 'closed'].includes(controller[K.STREAM][K.STATE]));

    if (controller[K.STREAM][K.STATE] === 'closed') {
        if (view.byteLength !== 0)
            throw new TypeError();
    } else {
        if (view.byteLength === 0)
            throw new TypeError();
    }

    if (firstDescriptor.byteOffset + firstDescriptor.bytesFilled !== view.byteOffset)
        throw new RangeError();
    if (firstDescriptor.bufferByteLength !== view.buffer.byteLength)
        throw new RangeError();
    if (firstDescriptor.bytesFilled + view.byteLength > firstDescriptor.byteLength)
        throw new RangeError();
    
    ReadableByteStreamControllerRespondInternal(controller, view.byteLength);
}


export function ReadableByteStreamControllerShouldCallPull(controller : AltReadableByteStreamController) {
    let stream = controller[K.STREAM];

    if (stream[K.STATE] !== 'readable' || controller[K.CLOSE_REQUESTED] || !controller[K.STARTED])
        return false;

    if (stream.locked && stream[K.READER][K.READ_REQUEST_SIZE] > 0)
        return true;
    
    let desiredSize = ReadableByteStreamControllerGetDesiredSize(controller);
    assert(() => desiredSize !== null);

    return desiredSize > 0;
}


export function ReadableByteStreamControllerCallPullIfNeeded(
    controller : AltReadableByteStreamController
) {
    if (!ReadableByteStreamControllerShouldCallPull(controller))
        return;

    if (controller[K.PULLING]) {
        controller[K.PULL_AGAIN] = true;
        return;
    }

    assert(() => !controller[K.PULL_AGAIN]);
    controller[K.PULLING] = true;

    let complete = () => {
        controller[K.PULLING] = false;
        if (controller[K.PULL_AGAIN]) {
            controller[K.PULL_AGAIN] = false;
            ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
    };

    let promise : void | PromiseLike<void>;

    try {
        promise = controller[K.PULL_ALGORITHM]();
    } catch (e) {
        ReadableByteStreamControllerError(controller, e);
        throw e;
    }

    if (promise) {
        React(promise, () => complete(), e => ReadableByteStreamControllerError(controller, e));
    } else {
        complete();
    }
}


export function ReadableByteStreamControllerHandleQueueDrain(
    controller : AltReadableByteStreamController
) {
    assert(() => controller[K.STREAM][K.STATE] === 'readable');
    if (controller[K.QUEUE_TOTAL_SIZE] === 0 && controller[K.CLOSE_REQUESTED]) {
        ReadableByteStreamControllerClearAlgorithms(controller);
        ReadableStreamClose(controller[K.STREAM]);
    } else {
        ReadableByteStreamControllerCallPullIfNeeded(controller);
    }
}


export function ReadableByteStreamControllerPullInto(
    controller : AltReadableByteStreamController, 
    view : ArrayBufferView, 
    request : ReadIntoRequest
) {
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

    if (controller[K.PENDING_PULL_INTOS].length > 0) {
        controller[K.PENDING_PULL_INTOS].push(descriptor);
        (<AltReadableStreamBYOBReader>controller[K.STREAM][K.READER])[K.READ_INTO_REQUESTS].push(request);
        return;
    }

    if (controller[K.STREAM][K.STATE] === 'closed') {
        let emptyView = new ctor(descriptor.buffer, descriptor.byteOffset, 0);
        request.close(emptyView);
        return;
    }

    if (controller[K.QUEUE_TOTAL_SIZE] > 0) {
        
        if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, descriptor)) {

            let filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(descriptor);
            ReadableByteStreamControllerHandleQueueDrain(controller);
            request.chunk(filledView);
            return;
        } else if (controller[K.CLOSE_REQUESTED]) {
            let e = new TypeError();
            ReadableByteStreamControllerError(controller, e);
            request.error(e);
            return;
        }
    }

    controller[K.PENDING_PULL_INTOS].push(descriptor);
    (<AltReadableStreamBYOBReader>controller[K.STREAM][K.READER])[K.READ_INTO_REQUESTS].push(request);
    ReadableByteStreamControllerCallPullIfNeeded(controller);
}

export function SetUpReadableByteStreamControllerFromUnderlyingSource(
    stream : AltReadableStream, 
    underlyingSource : UnderlyingByteSource,
    highWaterMark : number
) {
    let controller = new AltReadableByteStreamController();
    let start = () => {};
    let pull = () => Promise.resolve();
    let cancel = reason => Promise.resolve();

    if (!['function', 'undefined'].includes(typeof underlyingSource?.start))
        throw new TypeError(`start() must be a function`);
    if (!['function', 'undefined'].includes(typeof underlyingSource?.cancel))
        throw new TypeError(`cancel() must be a function`);
    if (!['function', 'undefined'].includes(typeof underlyingSource?.pull))
        throw new TypeError(`pull() must be a function`);
    
    let startCallback = underlyingSource?.start;
    let pullCallback = underlyingSource?.pull;
    let cancelCallback = underlyingSource?.cancel;

    if (startCallback)
        start = () => Reflect.apply(startCallback, underlyingSource, [controller]);
    if (pullCallback)
        pull = () => Reflect.apply(pullCallback, underlyingSource, [controller]);
    if (cancelCallback)
        cancel = reason => Reflect.apply(cancelCallback, underlyingSource, [reason]);

    let autoAllocateChunkSize = underlyingSource?.autoAllocateChunkSize;

    if (autoAllocateChunkSize === 0)
        throw new TypeError();

    SetUpReadableByteStreamController(stream, controller, start, pull, cancel, highWaterMark, autoAllocateChunkSize);
}

export function SetUpReadableByteStreamController(
    stream : AltReadableStream, 
    controller : AltReadableByteStreamController, 
    startAlgorithm : ReadableByteStreamControllerCallback, 
    pullAlgorithm : () => Promise<void>, 
    cancelAlgorithm : (reason) => Promise<void>, 
    highWaterMark : number, 
    autoAllocateChunkSize : number
) {
    assert(() => typeof stream[K.CONTROLLER] === 'undefined');

    if (autoAllocateChunkSize !== void 0) {
        assert(() => Number.isInteger(controller[K.AUTO_ALLOCATE_CHUNK_SIZE]));
        assert(() => controller[K.AUTO_ALLOCATE_CHUNK_SIZE] > 0);
    }

    controller[K.STREAM] = stream;
    controller[K.PULL_AGAIN] = false;
    controller[K.PULLING] = false;
    controller[K.BYOB_REQUEST] = null;
    controller[K.QUEUE] = [];
    controller[K.QUEUE_TOTAL_SIZE] = 0;
    controller[K.STRATEGY_HWM] = highWaterMark;
    controller[K.PULL_ALGORITHM] = pullAlgorithm;
    controller[K.CANCEL_ALGORITHM] = cancelAlgorithm;
    controller[K.AUTO_ALLOCATE_CHUNK_SIZE] = autoAllocateChunkSize;
    controller[K.PENDING_PULL_INTOS] = [];
    stream[K.CONTROLLER] = controller;

    let complete = () => {
        controller[K.STARTED] = true;
        assert(() => !controller[K.PULLING]);
        assert(() => !controller[K.PULL_AGAIN]);
        ReadableByteStreamControllerCallPullIfNeeded(controller);
    }

    let promise : void | PromiseLike<void>;

    try {
        promise = startAlgorithm(controller);
    } catch (e) {
        ReadableByteStreamControllerError(controller, e);
        throw e;
    }
    
    if (promise) {
        React(promise, () => complete(), e => ReadableByteStreamControllerError(controller, e));
    } else {
        complete();
    }
}

























export function ReadableStreamDefaultControllerCanCloseOrEnqueue(controller : AltReadableStreamDefaultController) {
    return controller[K.STREAM][K.STATE] === 'readable' && !controller[K.CLOSE_REQUESTED];
}

export function ReadableStreamDefaultControllerClearAlgorithms(controller : AltReadableStreamDefaultController) {
    controller[K.CANCEL_ALGORITHM] = undefined;
    controller[K.PULL_ALGORITHM] = undefined;
    controller[K.STRATEGY_SIZE_ALGORITHM] = undefined;
}

export function ReadableStreamDefaultControllerError(controller : AltReadableStreamDefaultController, error) {
    if (controller[K.STREAM][K.STATE] !== 'readable')
        return;
    controller[K.QUEUE] = [];
    controller[K.QUEUE_TOTAL_SIZE] = 0;
    ReadableStreamDefaultControllerClearAlgorithms(controller);
    ReadableStreamError(controller[K.STREAM], error);
}

export function ReadableStreamDefaultControllerShouldCallPull(controller : AltReadableStreamDefaultController) {
    if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller))
        return false;

    if (!controller[K.STARTED])
        return false;

    if (controller[K.STREAM].locked && controller[K.STREAM][K.READER][K.READ_REQUEST_SIZE] > 0)
        return true;
    
    let desiredSize = ReadableStreamDefaultControllerGetDesiredSize(controller);
    assert(() => desiredSize !== null);

    return desiredSize > 0;
    
}
export function ReadableStreamDefaultControllerPullIfNeeded(controller : AltReadableStreamDefaultController) {
    if (!ReadableStreamDefaultControllerShouldCallPull(controller)) {
        return;
    }

    if (controller[K.PULLING]) {
        controller[K.PULL_AGAIN] = true;
        return;
    }

    assert(() => !controller[K.PULL_AGAIN]);
    controller[K.PULLING] = true;

    let pullPromise : void | PromiseLike<void>;

    try {
        pullPromise = Promise.resolve(controller[K.PULL_ALGORITHM]());
    } catch (e) {
        ReadableStreamDefaultControllerError(controller, e);
        return;
    }
    
    let complete = () => {
        controller[K.PULLING] = false;
        if (controller[K.PULL_AGAIN]) {
            controller[K.PULL_AGAIN] = false;
            ReadableStreamDefaultControllerPullIfNeeded(controller)
        }
    };

    if (pullPromise) {
        React(pullPromise, () => complete(), e => ReadableStreamDefaultControllerError(controller, e));
    } else {
        complete();
    }
}


export function SetUpReadableStreamDefaultControllerFromUnderlyingSource(
    stream : AltReadableStream, 
    underlyingSource : UnderlyingSource,
    highWaterMark : number,
    sizeAlgorithm : QueuingStrategySizeCallback
) {
    let controller = new AltReadableStreamDefaultController();

    let startAlgorithm = () => {};
    let pullAlgorithm = () => Promise.resolve();
    let cancelAlgorithm = reason => Promise.resolve();

    let sourceStart = underlyingSource?.start;
    let sourcePull = underlyingSource?.pull;
    let sourceCancel = underlyingSource?.cancel;
    
    if (!['function', 'undefined'].includes(typeof sourceStart))
        throw new TypeError(`start() must be a function`);
    if (!['function', 'undefined'].includes(typeof sourceCancel))
        throw new TypeError(`cancel() must be a function`);
    if (!['function', 'undefined'].includes(typeof sourcePull))
        throw new TypeError(`pull() must be a function`);

    if (sourceStart)
        startAlgorithm = () => Reflect.apply(sourceStart, underlyingSource, [controller]);
    if (sourcePull) {
        pullAlgorithm = () => {
            try {
                return Promise.resolve(Reflect.apply(sourcePull, underlyingSource, [controller]));
            } catch (e) {
                return RejectHandled(e);
            }
        }
    }
    if (sourceCancel) {
        cancelAlgorithm = reason => {
            try {
                return Promise.resolve(Reflect.apply(sourceCancel, underlyingSource, [reason]));
            } catch (e) {
                return RejectHandled(e);
            }
        }
    }

    SetUpReadableStreamDefaultController(
        stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm
    );
}

export function SetUpReadableStreamDefaultController(
    stream : AltReadableStream, 
    controller : AltReadableStreamDefaultController, 
    startAlgorithm : () => (void | Promise<void>),
    pullAlgorithm : () => Promise<void>, 
    cancelAlgorithm : (e) => Promise<void>, 
    highWaterMark : number, 
    sizeAlgorithm
) {
    assert(() => typeof stream[K.CONTROLLER] === 'undefined');
    controller[K.STREAM] = stream;
    ResetQueue(controller);
    controller[K.STARTED] = false;
    controller[K.CLOSE_REQUESTED] = false;
    controller[K.PULL_AGAIN] = false;
    controller[K.PULLING] = false;
    controller[K.STRATEGY_SIZE_ALGORITHM] = sizeAlgorithm;
    controller[K.STRATEGY_HWM] = highWaterMark;
    controller[K.PULL_ALGORITHM] = pullAlgorithm;
    controller[K.CANCEL_ALGORITHM] = cancelAlgorithm;
    stream[K.CONTROLLER] = controller;
    
    let result : void | PromiseLike<void>;

    try {
        result = startAlgorithm();
    } catch (e) {
        ReadableStreamDefaultControllerError(controller, e);
        throw e;
    }

    React(
        result, 
        () => {
            controller[K.STARTED] = true;
            assert(() => !controller[K.PULLING]);
            assert(() => !controller[K.PULL_AGAIN]);
            ReadableStreamDefaultControllerPullIfNeeded(controller);
        }, 
        e => ReadableStreamDefaultControllerError(controller, e)
    );
}

export function ReadableStreamDefaultControllerEnqueue(controller : AltReadableStreamDefaultController, chunk : any) {    
    if (controller[K.STREAM].locked && controller[K.STREAM][K.READER][K.READ_REQUEST_SIZE] > 0) {
        FulfillReadRequest(controller[K.STREAM], chunk, false);
    } else {
        let chunkSize : number;
        try {
            chunkSize = controller[K.STRATEGY_SIZE_ALGORITHM](chunk);
        } catch (e) {
            ReadableStreamDefaultControllerError(controller, e);
            throw e;
        }

        try {
            EnqueueValueWithSize(controller, chunk, chunkSize);
        } catch (e) {
            ReadableStreamDefaultControllerError(controller, e);
            throw e;
        }
    }

    ReadableStreamDefaultControllerPullIfNeeded(controller);
}

export function ReadableStreamDefaultControllerClose(controller : AltReadableStreamDefaultController) {
    controller[K.CLOSE_REQUESTED] = true;
    if (controller[K.QUEUE].length === 0) {
        ReadableStreamDefaultControllerClearAlgorithms(controller);
        ReadableStreamClose(controller[K.STREAM]);
    }
}

export function ReadableStreamReaderGenericRelease(reader : AltReadableStreamDefaultReader | AltReadableStreamBYOBReader) {
    assert(() => !!reader[K.STREAM]);
    assert(() => reader[K.STREAM][K.READER] === reader);

    if (reader[K.STREAM][K.STATE] === 'readable')
        reader[K.CLOSED].reject(new TypeError(`Cannot release lock while stream is readable`));
    else
        reader[K.CLOSED] = PromiseController.reject(new TypeError());
    reader[K.CLOSED].markHandled();
    reader[K.STREAM][K.READER] = undefined;
    reader[K.STREAM] = undefined;
}

export function ReadableStreamBYOBReaderRead(reader : AltReadableStreamBYOBReader, view, readIntoRequest : ReadIntoRequest) {
    let stream = reader[K.STREAM];
    assert(() => !!stream);

    stream[K.DISTURBED] = true;
    if (stream[K.STATE] === 'errored')
        readIntoRequest.error(stream[K.STORED_ERROR]);

    ReadableByteStreamControllerPullInto(stream[K.CONTROLLER] as AltReadableByteStreamController, view, readIntoRequest);
}

export function ReadableStreamReaderGenericCancel(reader : AltReadableStreamDefaultReader | AltReadableStreamBYOBReader, reason) {
    let stream = reader[K.STREAM];
    assert(() => !!stream);
    return ReadableStreamCancel(stream, reason);
}

export function ReadableStreamDefaultReaderRead(reader : AltReadableStreamDefaultReader, readRequest : ReadRequest) {
    let stream = reader[K.STREAM];
    assert(() => !!stream);
    stream[K.DISTURBED] = true;
    if (stream[K.STATE] === 'closed') {
        readRequest.close();
    } else if (stream[K.STATE] === 'errored') {
        readRequest.error(stream[K.STORED_ERROR]);
    } else {
        assert(() => stream[K.STATE] === 'readable');
        stream[K.CONTROLLER][K.PULL_STEPS](readRequest);
    }
}

export function ReadableStreamTee<T>(stream : AltReadableStream, cloneForBranch2 : boolean): [ReadableStream<T>, ReadableStream<T>] {
    //assert(() => stream implements ReadableStream); 
    assert(() => typeof cloneForBranch2 === 'boolean');
    if (stream[K.CONTROLLER] instanceof AltReadableByteStreamController) {
        return ReadableByteStreamTee(stream);
    }

    return ReadableStreamDefaultTee(stream, cloneForBranch2);
}

export function StructuredClone(value) {
    return value; // TODO
}

export function ReadableStreamDefaultTee<T>(stream : AltReadableStream, cloneForBranch2 : boolean): [ReadableStream<T>, ReadableStream<T>] {
    assert(() => stream instanceof AltReadableStream);
    assert(() => typeof cloneForBranch2 === 'boolean');
    let reader = AcquireReadableStreamDefaultReader(stream);
    let reading = false;
    let readAgain = false;
    let canceled1 = false;
    let canceled2 = false;
    let reason1 = undefined;
    let reason2 = undefined;
    let branch1 : AltReadableStream = undefined;
    let branch2 : AltReadableStream = undefined;
    let cancelPromise = new PromiseController();
    let pullAlgorithm : () => void;
    
    pullAlgorithm = () => {
        if (reading) {
            readAgain = true;
            return Promise.resolve();
        }

        reading = true;
        let readRequest : ReadRequest = {
            chunk(chunk) {
                queueMicrotask(() => {
                    readAgain = false;
                    let chunk1 = chunk, chunk2 = chunk;
                    let controller1 = <AltReadableStreamDefaultController>branch1[K.CONTROLLER];
                    let controller2 = <AltReadableStreamDefaultController>branch2[K.CONTROLLER];

                    if (!canceled2 && cloneForBranch2) {
                        try {
                            chunk2 = StructuredClone(chunk2)
                        } catch (e) {
                            ReadableStreamDefaultControllerError(controller1, e);
                            ReadableStreamDefaultControllerError(controller2, e);
                            ReadableStreamCancel(stream, e);
                            return;
                        }
                    }

                    if (!canceled1)
                        ReadableStreamDefaultControllerEnqueue(controller1, chunk1);
                    if (!canceled2)
                        ReadableStreamDefaultControllerEnqueue(controller2, chunk2);

                    reading = false;
                    if (readAgain)
                        pullAlgorithm();
                });
            },

            close() {
                let controller1 = <AltReadableStreamDefaultController>branch1[K.CONTROLLER];
                let controller2 = <AltReadableStreamDefaultController>branch2[K.CONTROLLER];

                reading = false;
                if (!canceled1)
                    ReadableStreamDefaultControllerClose(controller1);
                if (!canceled2)
                    ReadableStreamDefaultControllerClose(controller2);
                if (!canceled1 || !canceled2)
                    cancelPromise.resolve();
            },

            error(e) {
                reading = false;
            }
        }

        ReadableStreamDefaultReaderRead(reader, readRequest);
        return Promise.resolve();
    }
    
    let cancel1Algorithm = reason => {
        canceled1 = true;
        reason1 = reason;
        if (canceled2) {
            let compositeReason = [ reason1, reason2 ];
            let cancelResult = ReadableStreamCancel(stream, compositeReason);
            cancelPromise.resolve(cancelResult);
        }

        return cancelPromise.promise;
    };

    let cancel2Algorithm = reason => {
        canceled2 = true;
        reason2 = reason;
        if (canceled1) {
            let compositeReason = [ reason1, reason2 ];
            let cancelResult = ReadableStreamCancel(stream, compositeReason);
            cancelPromise.resolve(cancelResult);
        }
        return cancelPromise.promise;
    };

    let startAlgorithm = () => undefined;
    branch1 = new AltReadableStream({
        start: startAlgorithm,
        pull: pullAlgorithm,
        cancel: cancel1Algorithm
    });
    branch2 = new AltReadableStream({
        start: startAlgorithm,
        pull: pullAlgorithm,
        cancel: cancel2Algorithm
    });

    Catch(reader[K.CLOSED].promise, r => {
        let controller1 = <AltReadableStreamDefaultController>branch1[K.CONTROLLER];
        let controller2 = <AltReadableStreamDefaultController>branch2[K.CONTROLLER];
        ReadableStreamDefaultControllerError(controller1, r);
        ReadableStreamDefaultControllerError(controller2, r);
        if (!canceled1 || !canceled2)
            cancelPromise.resolve();
    });

    return [ branch1, branch2 ];
}

export function ReadableByteStreamControllerGetBYOBRequest(controller : AltReadableByteStreamController) {
    if (controller[K.BYOB_REQUEST] === null && controller[K.PENDING_PULL_INTOS].length > 0) {
        let first = controller[K.PENDING_PULL_INTOS][0];
        let view = new Uint8Array(first.buffer, first.byteOffset + first.bytesFilled, first.byteLength - first.bytesFilled);
        let byobRequest = new AltReadableStreamBYOBRequest();
        byobRequest[K.CONTROLLER] = controller;
        byobRequest[K.VIEW] = view;
        controller[K.BYOB_REQUEST] = byobRequest;
    }

    return controller[K.BYOB_REQUEST];
}

export function IsArrayBufferView(O) {
    return O instanceof Int8Array
        || O instanceof Uint8Array
        || O instanceof Uint8ClampedArray
        || O instanceof Int16Array
        || O instanceof Uint16Array
        || O instanceof Int32Array
        || O instanceof Uint32Array
        || O instanceof Float32Array
        || O instanceof Float64Array
        || O instanceof DataView
    ;
}

export function CloneAsUint8Array(O : ArrayBufferView) {
    assert(() => typeof O === 'object');
    assert(() => IsArrayBufferView(O));
    return new Uint8Array(O.buffer.slice(O.byteOffset, O.byteOffset + O.byteLength));
}

export function ReadableByteStreamTee<T>(stream : AltReadableStream): [ReadableStream<T>, ReadableStream<T>] {
    assert(() => stream instanceof AltReadableStream);
    assert(() => stream[K.CONTROLLER] instanceof AltReadableByteStreamController);
    let reader : AltReadableStreamDefaultReader | AltReadableStreamBYOBReader = AcquireReadableStreamDefaultReader(stream);
    let reading = false;
    let readAgainForBranch1 = false;
    let readAgainForBranch2 = false;
    let canceled1 = false;
    let canceled2 = false;
    let reason1 = undefined;
    let reason2 = undefined;
    let branch1 : AltReadableStream = undefined;
    let branch2 : AltReadableStream = undefined;
    let cancelPromise = new PromiseController();

    let forwardReaderError = (thisReader : AltReadableStreamDefaultReader | AltReadableStreamBYOBReader) => {
        Catch(thisReader[K.CLOSED].promise, r => {
            if (thisReader !== reader)
                return;
            ReadableByteStreamControllerError(branch1[K.CONTROLLER] as AltReadableByteStreamController, r);
            ReadableByteStreamControllerError(branch2[K.CONTROLLER] as AltReadableByteStreamController, r);
            if (!canceled1 || !canceled2)
                cancelPromise.resolve();
        });
    }

    let pullWithDefaultReader = () => {
        if (reader instanceof AltReadableStreamBYOBReader) {
            assert(() => (<AltReadableStreamBYOBReader><unknown>reader)[K.READ_INTO_REQUESTS].length === 0);
            ReadableStreamReaderGenericRelease(reader);
            reader = AcquireReadableStreamDefaultReader(stream);
            forwardReaderError(reader);
        }

        let readRequest = <ReadRequest>{
            chunk(chunk) {
                queueMicrotask(() => {
                    let controller1 = <AltReadableByteStreamController>branch1[K.CONTROLLER];
                    let controller2 = <AltReadableByteStreamController>branch2[K.CONTROLLER];

                    readAgainForBranch1 = false;
                    readAgainForBranch2 = false;
                    let chunk1 = chunk, chunk2 = chunk;
                    if (!canceled1 && !canceled2) {
                        try {
                            chunk2 = CloneAsUint8Array(chunk);
                        } catch (e) {
                            ReadableByteStreamControllerError(controller1, e);
                            ReadableByteStreamControllerError(controller2, e);
                            cancelPromise.resolve(ReadableStreamCancel(stream, e));
                            return;
                        }
                    }

                    if (!canceled1) ReadableByteStreamControllerEnqueue(controller1, chunk1);
                    if (!canceled2) ReadableByteStreamControllerEnqueue(controller2, chunk2);

                    reading = false;
                    if (readAgainForBranch1)
                        pull1Algorithm();
                    else if (readAgainForBranch2)
                        pull2Algorithm();
                });
            },
            close() {
                let controller1 = <AltReadableByteStreamController>branch1[K.CONTROLLER];
                let controller2 = <AltReadableByteStreamController>branch2[K.CONTROLLER];

                reading = false;
                if (!canceled1)
                    ReadableByteStreamControllerClose(controller1);
                if (!canceled2)
                    ReadableByteStreamControllerClose(controller2);
                if (controller1[K.PENDING_PULL_INTOS].length > 0)
                    ReadableByteStreamControllerRespond(controller1, 0);
                if (controller2[K.PENDING_PULL_INTOS].length > 0)
                    ReadableByteStreamControllerRespond(controller2, 0);
                if (!canceled1 || !canceled2)
                    cancelPromise.resolve();
            },
            error(error) {
                reading = false;
            }
        };

        ReadableStreamDefaultReaderRead(reader, readRequest);
    }

    let pullWithBYOBReader = (view, forBranch2) => {
        if (reader instanceof AltReadableStreamDefaultReader) {
            assert(() => (reader as AltReadableStreamDefaultReader)[K.READ_REQUESTS].length === 0);
            ReadableStreamReaderGenericRelease(reader);
            reader = AcquireReadableStreamBYOBReader(stream);
            forwardReaderError(reader);
        }

        let byobBranch = forBranch2 ? branch2 : branch1;
        let otherBranch = forBranch2 ? branch1 : branch2;

        let readIntoRequest = <ReadIntoRequest>{
            chunk(chunk : ArrayBufferView) {
                queueMicrotask(() => {
                    readAgainForBranch1 = false;
                    readAgainForBranch2 = false;
                    let byobCanceled = forBranch2 ? canceled2 : canceled1;
                    let otherCanceled = forBranch2 ? canceled1 : canceled2;
                    let byobController = byobBranch[K.CONTROLLER] as AltReadableByteStreamController;
                    let otherController = otherBranch[K.CONTROLLER] as AltReadableByteStreamController;

                    if (!otherCanceled) {
                        let clonedChunk : ArrayBufferView;

                        try {
                            clonedChunk = CloneAsUint8Array(chunk);
                        } catch (e) {
                            ReadableByteStreamControllerError(byobController, e);
                            ReadableByteStreamControllerError(otherController, e);
                            cancelPromise.resolve(ReadableStreamCancel(stream, e));
                            return;
                        }

                        if (!byobCanceled) ReadableByteStreamControllerRespondWithNewView(byobController, chunk);
                        ReadableByteStreamControllerEnqueue(otherController, clonedChunk);
                    } else if (!byobCanceled) {
                        ReadableByteStreamControllerRespondWithNewView(byobController, chunk);
                    }

                    reading = false;
                    if (readAgainForBranch1)
                        pull1Algorithm();
                    else if (readAgainForBranch2)
                        pull2Algorithm();
                });
            },

            close(chunk : ArrayBufferView) {
                reading = false;
                let byobCanceled = forBranch2 ? canceled2 : canceled1;
                let otherCanceled = forBranch2 ? canceled1 : canceled2;
                let byobController = byobBranch[K.CONTROLLER] as AltReadableByteStreamController;
                let otherController = otherBranch[K.CONTROLLER] as AltReadableByteStreamController;

                if (!byobCanceled)
                    ReadableByteStreamControllerClose(byobController);
                if (!otherCanceled)
                    ReadableByteStreamControllerClose(otherController);
                if (chunk) {
                    assert(() => chunk.byteLength === 0);
                    if (!byobCanceled)
                        ReadableByteStreamControllerRespondWithNewView(byobController, chunk);

                    if (!otherCanceled && otherController[K.PENDING_PULL_INTOS].length > 0)
                        ReadableByteStreamControllerRespond(otherController, 0);
                }

                if (!byobCanceled || !otherCanceled)
                    cancelPromise.resolve();
            },

            error() {
                reading = false;
            }
        }

        ReadableStreamBYOBReaderRead(reader, view, readIntoRequest);
    }

    let pull1Algorithm = () => {
        if (reading) {
            readAgainForBranch1 = true;
            return Promise.resolve();
        }

        reading = true;
        let byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch1[K.CONTROLLER] as AltReadableByteStreamController);
        if (byobRequest === null)
            pullWithDefaultReader();
        else
            pullWithBYOBReader(byobRequest[K.VIEW], false);

        return Promise.resolve();
    }

    let pull2Algorithm = () => {
        if (reading) {
            readAgainForBranch2 = true;
            return Promise.resolve();
        }

        reading = true;
        let byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch2[K.CONTROLLER] as AltReadableByteStreamController);
        if (byobRequest === null)
            pullWithDefaultReader();
        else
            pullWithBYOBReader(byobRequest[K.VIEW], true);
        
        return Promise.resolve();
    }

    let cancel1Algorithm = reason => {
        canceled1 = true;
        reason1 = reason;
        if (canceled2) {
            let compositeReason = [ reason1, reason2 ];
            let cancelResult = ReadableStreamCancel(stream, compositeReason);
            cancelPromise.resolve(cancelResult);
        }

        return cancelPromise.promise;
    };

    let cancel2Algorithm = reason => {
        canceled2 = true;
        reason2 = reason;
        if (canceled1) {
            let compositeReason = [ reason1, reason2 ];
            let cancelResult = ReadableStreamCancel(stream, compositeReason);
            cancelPromise.resolve(cancelResult);
        }

        return cancelPromise.promise;
    }

    let startAlgorithm = () => undefined;

    branch1 = new AltReadableStream({
        type: 'bytes',
        start: startAlgorithm,
        pull: pull1Algorithm,
        cancel: cancel1Algorithm
    });

    branch2 = new AltReadableStream({
        type: 'bytes',
        start: startAlgorithm,
        pull: pull2Algorithm,
        cancel: cancel2Algorithm
    });

    forwardReaderError(reader);

    return [ branch1, branch2 ];
}

export function AcquireReadableStreamDefaultReader(stream : AltReadableStream) {
    return new AltReadableStreamDefaultReader(stream);
}

export function AcquireReadableStreamBYOBReader(stream : AltReadableStream) {
    return new AltReadableStreamBYOBReader(stream);
}

export function ReadableStreamReaderGenericInitialize(reader : AltReadableStreamDefaultReader | AltReadableStreamBYOBReader, stream : AltReadableStream) {
    reader[K.STREAM] = <AltReadableStream>stream;
    stream[K.READER] = reader;

    if (stream[K.STATE] === 'readable') {
        reader[K.CLOSED] = new PromiseController();
    } else if (stream[K.STATE] === 'closed') {
        reader[K.CLOSED] = PromiseController.resolve();
    } else {
        assert(() => stream[K.STATE] === 'errored');
        reader[K.CLOSED] = PromiseController.reject(stream[K.STORED_ERROR]).markHandled();
    }
}

export function ReadableStreamClose(stream : AltReadableStream) {
    assert(() => stream[K.STATE] === 'readable');
    stream[K.STATE] = 'closed';

    let reader = stream[K.READER];
    if (!reader)
        return;

    reader[K.CLOSED].resolve();

    if (reader instanceof AltReadableStreamDefaultReader) {
        let defaultReader = reader as ReadableStreamDefaultReader;
        defaultReader[K.READ_REQUESTS].forEach(r => r.close());
        defaultReader[K.READ_REQUESTS] = [];
    }
}

export function ReadableStreamError(stream : AltReadableStream, e) {
    assert(() => stream[K.STATE] === 'readable');
    stream[K.STATE] = 'errored';
    stream[K.STORED_ERROR] = e;
    let reader = stream[K.READER];
    if (!reader)
        return;
    
    reader[K.CLOSED].reject(e).markHandled();
    if (reader instanceof AltReadableStreamDefaultReader) {
        reader[K.READ_REQUESTS].forEach(r => r.error(e));
        reader[K.READ_REQUESTS] = [];
    } else {
        assert(() => reader instanceof AltReadableStreamBYOBReader);
        reader[K.READ_INTO_REQUESTS].forEach(r => r.error(e));
        reader[K.READ_INTO_REQUESTS] = [];
    }
}

export function ReadableStreamCancel(stream : AltReadableStream, reason) {
	stream[K.DISTURBED] = true;
    
    if (stream[K.STATE] === 'closed')
        return Promise.resolve();

    if (stream[K.STATE] === 'errored') {
        return Promise.reject(stream[K.STORED_ERROR]);
    }
    
    ReadableStreamClose(stream);

    if (stream[K.READER] && stream[K.READER] instanceof AltReadableStreamBYOBReader) {
        for (let request of stream[K.READER][K.READ_INTO_REQUESTS]) {
            request.close(undefined);
        }

        stream[K.READER][K.READ_INTO_REQUESTS] = [];
    }

    let sourceCancelPromise = stream[K.CONTROLLER][K.CANCEL_STEPS](reason);
    return React(sourceCancelPromise, () => undefined);
}

export function ReadableStreamPipeTo(
    source : AltReadableStream, 
    dest : AltWritableStream, 
    preventClose : boolean, 
    preventAbort : boolean, 
    preventCancel : boolean, 
    signal : AbortSignal
): Promise<void> {
    assert(() => source instanceof AltReadableStream);
    assert(() => dest instanceof AltWritableStream);
    assert(() => typeof preventClose === 'boolean');
    assert(() => typeof preventAbort === 'boolean');
    assert(() => typeof preventCancel === 'boolean');
    assert(() => signal === void 0 || signal instanceof AbortSignal);
    assert(() => !IsReadableStreamLocked(source));
    assert(() => !IsWritableStreamLocked(dest));

    let reader = AcquireReadableStreamDefaultReader(source);
    let writer = new AltWritableStreamDefaultWriter(dest);

    source[K.DISTURBED] = true;
    let shuttingDown = false;
    let promise = new PromiseController();
    let abortAlgorithm : () => void;
    let currentWrite = Resolve(undefined);

    function Shutdown(isError : boolean, error?) {
        ShutdownWithAction(undefined, isError, error);
    }

    function IsOrBecomesErrored(stream, promise, action) {
        if (stream._state === 'errored') {
            action(stream._storedError);
        } else {
            Catch(promise, action);
        }
    }

    function IsOrBecomesClosed(stream, promise, action) {
        if (stream._state === 'closed') {
            action();
        } else {
            React(promise, action);
        }
    }
  
    function WaitForWritesToFinish() {
        // Another write may have started while we were waiting on this currentWrite, so we have to be sure to wait
        // for that too.
        const oldCurrentWrite = currentWrite;
        return React(
            currentWrite,
            () => oldCurrentWrite !== currentWrite ? WaitForWritesToFinish() : undefined
        );
    }

    function ShutdownWithAction(action : () => Promise<any>, originalIsError : boolean, originalError?) {
        if (shuttingDown)
            return;
        shuttingDown = true;
        if (dest[K.STATE] === 'writable' && !WritableStreamCloseQueuedOrInFlight(dest)) {
            React(WaitForWritesToFinish(), complete);
        } else {
            complete();
        }

        function complete() {
            if (action) {
                React(action(), () => Finalize(originalIsError, originalError), e => Finalize(true, e));
            } else {
                Finalize(originalIsError, originalError);
            }
        }
    }

    function Finalize(isError : boolean, error?) {
        WritableStreamDefaultWriterRelease(writer);
        ReadableStreamReaderGenericRelease(reader);

        if (signal !== undefined)
            signal.removeEventListener('abort', abortAlgorithm);

        if (isError)
            promise.reject(error);
        else
            promise.resolve();
    }

    if (signal) {
        abortAlgorithm = () => {
            let error = (signal as AltAbortSignal).reason;
            let actions = [];
            if (!preventAbort) {
                actions.push(() => {
                    if (dest[K.STATE] === 'writable')
                        return WritableStreamAbort(dest, error);
                    else
                        return Resolve(undefined);
                });
            }

            if (!preventCancel) {
                actions.push(() => {
                    if (source[K.STATE] === 'readable')
                        return ReadableStreamCancel(source, error);
                    else
                        return Resolve(undefined);
                });
            }

            ShutdownWithAction(() => All(actions), error);
        }

        if (signal.aborted) {
            abortAlgorithm();
            return promise.promise;
        }

        signal.addEventListener('abort', abortAlgorithm);
    }

    // Errors must be propagated forward
    IsOrBecomesErrored(source, reader[K.CLOSED].promise, storedError => {
        if (preventAbort === false) {
            ShutdownWithAction(() => WritableStreamAbort(dest, storedError), true, storedError);
        } else {
            Shutdown(true, storedError);
        }
    });

    // Errors must be propagated backward
    IsOrBecomesErrored(dest, writer[K.CLOSED].promise, storedError => {
        if (preventCancel === false) {
            ShutdownWithAction(() => ReadableStreamCancel(source, storedError), true, storedError);
        } else {
            Shutdown(true, storedError);
        }
    });

    // Closing must be propagated forward
    IsOrBecomesClosed(source, reader[K.CLOSED].promise, () => {
        if (preventClose === false) {
            ShutdownWithAction(() => WritableStreamDefaultWriterCloseWithErrorPropagation(writer), false);
        } else {
            Shutdown(false);
        }
    });

    // Closing must be propagated backward
    if (WritableStreamCloseQueuedOrInFlight(dest) === true || dest[K.STATE] === 'closed') {
        console.log(`EARLY DETECT...`);
        const destClosed = new TypeError('the destination writable stream closed before all data could be piped to it');

        if (preventCancel === false) {
            ShutdownWithAction(() => ReadableStreamCancel(source, destClosed), true, destClosed);
        } else {
            Shutdown(true, destClosed);
        }
    }

    SetPromiseIsHandledToTrue(Loop(() => {
        if (shuttingDown === true) {
            return Resolve(true);
          }
    
          return React(writer[K.READY].promise, () => {
            return new Promise<boolean>((resolveRead, rejectRead) => {
              ReadableStreamDefaultReaderRead(
                reader,
                {
                  chunk: chunk => {
                    currentWrite = React(
                      WritableStreamDefaultWriterWrite(writer, chunk), 
                      undefined, 
                      () => {}
                    );
                    resolveRead(false);
                  },
                  close: () => resolveRead(true),
                  error: rejectRead
                }
              );
            });
          });
    }));

    return promise.promise;
}

export function SetUpWritableStreamDefaultControllerFromUnderlyingSink(
    stream : AltWritableStream, 
    underlyingSink : UnderlyingSink,
    highWaterMark : number,
    sizeAlgorithm
) {
    let controller = new AltWritableStreamDefaultController(K.NEW);
    
    let startAlgorithm = () => Promise.resolve();
    let writeAlgorithm = chunk => Promise.resolve();
    let closeAlgorithm = () => Promise.resolve();
    let abortAlgorithm = error => Promise.resolve();

    if (!['function', 'undefined'].includes(typeof underlyingSink?.start))
        throw new TypeError(`start() must be a function`);
    if (!['function', 'undefined'].includes(typeof underlyingSink?.write))
        throw new TypeError(`write() must be a function`);
    if (!['function', 'undefined'].includes(typeof underlyingSink?.close))
        throw new TypeError(`close() must be a function`);
    if (!['function', 'undefined'].includes(typeof underlyingSink?.abort))
        throw new TypeError(`abort() must be a function`);

    if (underlyingSink?.start)
        startAlgorithm = () => Reflect.apply(underlyingSink.start, underlyingSink, [controller]);
    if (underlyingSink?.write) {
        writeAlgorithm = chunk => {
            try {
                return Reflect.apply(underlyingSink.write, underlyingSink, [chunk, controller]);
            } catch (e) {
                return RejectHandled(e);
            }
        };
    }
    if (underlyingSink?.close) {
        closeAlgorithm = () => {
            try {
                return Reflect.apply(underlyingSink.close, underlyingSink, []);
            } catch (e) {
                return RejectHandled(e);
            }
        }
    }
    if (underlyingSink?.abort) {
        abortAlgorithm = error => {
            try {
                return Reflect.apply(underlyingSink.abort, underlyingSink, [error]);
            } catch (e) {
                return RejectHandled(e);
            }
        }
    }

    SetUpWritableStreamDefaultController(
        stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, 
        abortAlgorithm, highWaterMark, sizeAlgorithm
    );
}

function SetUpWritableStreamDefaultController(
    stream : AltWritableStream, 
    controller : AltWritableStreamDefaultController,
    startAlgorithm, 
    writeAlgorithm, 
    closeAlgorithm, 
    abortAlgorithm, 
    highWaterMark : number, 
    sizeAlgorithm
) {
    assert(() => stream instanceof AltWritableStream);
    assert(() => stream[K.CONTROLLER] === void 0);
    
    controller[K.STREAM] = stream;
    stream[K.CONTROLLER] = controller;

    ResetQueue(controller);

    controller[K.SIGNAL_CONTROLLER] = new AbortController();
    controller[K.SIGNAL] = controller[K.SIGNAL_CONTROLLER].signal;
    controller[K.STARTED] = false;
    controller[K.STRATEGY_SIZE_ALGORITHM] = sizeAlgorithm;
    controller[K.STRATEGY_HWM] = highWaterMark;
    controller[K.WRITE_ALGORITHM] = writeAlgorithm;
    controller[K.CLOSE_ALGORITHM] = closeAlgorithm;
    controller[K.ABORT_ALGORITHM] = abortAlgorithm;

    let backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
    WritableStreamUpdateBackpressure(stream, backpressure);

    let startResult = startAlgorithm();
    let startPromise = Promise.resolve(startResult);

    React(
        startPromise,
        () => {
            assert(() => ['writable', 'erroring'].includes(stream[K.STATE]));
            controller[K.STARTED] = true;
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }, r => {
            assert(() => ['writable', 'erroring'].includes(stream[K.STATE]));
            controller[K.STARTED] = true;
            WritableStreamDealWithRejection(stream, r);
        }
    );
}

export function WritableStreamDefaultControllerGetBackpressure(controller : AltWritableStreamDefaultController) {
    return WritableStreamDefaultControllerGetDesiredSize(controller) <= 0;
}

export function WritableStreamDefaultControllerGetDesiredSize(controller : WritableStreamDefaultController) {
    return controller[K.STRATEGY_HWM] - controller[K.QUEUE_TOTAL_SIZE];
}

export function WritableStreamUpdateBackpressure(stream : AltWritableStream, backpressure : boolean) {
    assert(() => stream[K.STATE] === 'writable');
    assert(() => !WritableStreamCloseQueuedOrInFlight(stream));
    let writer = stream[K.WRITER];
    if (writer && backpressure !== stream[K.BACKPRESSURE]) {
        if (backpressure) {
            writer[K.READY] = new PromiseController();
        } else {
            assert(() => !backpressure);
            writer[K.READY].resolve();
        }
    }

    stream[K.BACKPRESSURE] = backpressure;
}

export function WritableStreamCloseQueuedOrInFlight(stream : AltWritableStream) {
    if (stream[K.CLOSE_REQUEST] === void 0 && stream[K.IN_FLIGHT_CLOSE_REQUEST] === void 0)
        return false;
    return true;
}

export function WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller : AltWritableStreamDefaultController) {
    let stream = controller[K.STREAM];
    if (!controller[K.STARTED])
        return;
    if (stream[K.IN_FLIGHT_WRITE_REQUEST])
        return;

    let state = stream[K.STATE];
    assert(() => state !== 'closed' && state !== 'errored');
    if (state === 'erroring') {
        WritableStreamFinishErroring(stream);
        return;
    }

    if (controller[K.QUEUE].length === 0)
        return;
       
    
    let value = PeekQueueValue(controller);

    if (value === CLOSE_SENTINEL) {
        WritableStreamDefaultControllerProcessClose(controller);
    } else {
        WritableStreamDefaultControllerProcessWrite(controller, value);
    }
}

function WritableStreamDefaultControllerProcessClose(controller : AltWritableStreamDefaultController) {
    let stream = controller[K.STREAM];
    WritableStreamMarkCloseRequestInFlight(stream);
    DequeueValue(controller);
    assert(() => controller[K.QUEUE].length === 0);
    let sinkClosePromise = controller[K.CLOSE_ALGORITHM]();

    WritableStreamDefaultControllerClearAlgorithms(controller);

    React(
        sinkClosePromise, 
        () => {
            WritableStreamFinishInFlightClose(stream);
        }, e => {
            WritableStreamFinishInFlightCloseWithError(stream, e);
        }
    );
}

export function WritableStreamFinishInFlightClose(stream : AltWritableStream) {
    assert(() => !!stream[K.IN_FLIGHT_CLOSE_REQUEST])
    stream[K.IN_FLIGHT_CLOSE_REQUEST].resolve();
    stream[K.IN_FLIGHT_CLOSE_REQUEST] = undefined;
    assert(() => ['writable', 'erroring'].includes(stream[K.STATE]));
    if (stream[K.STATE] === 'erroring') {
        stream[K.STORED_ERROR] = undefined;
        if (stream[K.PENDING_ABORT_REQUEST]) {
            stream[K.PENDING_ABORT_REQUEST].promise.resolve();
            stream[K.PENDING_ABORT_REQUEST] = undefined;
        }
    }

    stream[K.STATE] = 'closed';
    if (stream[K.WRITER])
        stream[K.WRITER][K.CLOSED].resolve();
    assert(() => !stream[K.PENDING_ABORT_REQUEST]);
    assert(() => !stream[K.STORED_ERROR]);
} 

export function WritableStreamFinishInFlightCloseWithError(stream : AltWritableStream, error) {
    assert(() => !!stream[K.IN_FLIGHT_CLOSE_REQUEST]);
    stream[K.IN_FLIGHT_CLOSE_REQUEST].reject(error);
    stream[K.IN_FLIGHT_CLOSE_REQUEST] = undefined;
    assert(() => ['writable', 'erroring'].includes(stream[K.STATE]));

    if (stream[K.PENDING_ABORT_REQUEST]) {
        stream[K.PENDING_ABORT_REQUEST].promise.reject(error);
        stream[K.PENDING_ABORT_REQUEST] = undefined;
    }

    if (stream[K.STATE] === 'writable') {
        WritableStreamStartErroring(stream, error);
        return;
    }

    assert(() => stream[K.STATE] === 'erroring');
    WritableStreamFinishErroring(stream);
}

export function WritableStreamMarkCloseRequestInFlight(stream : AltWritableStream) {
    assert(() => stream[K.IN_FLIGHT_CLOSE_REQUEST] === void 0);
    assert(() => stream[K.CLOSE_REQUEST] !== void 0);
    stream[K.IN_FLIGHT_CLOSE_REQUEST] = stream[K.CLOSE_REQUEST];
    stream[K.CLOSE_REQUEST] = undefined;
}

export function WritableStreamMarkFirstWriteRequestInFlight(stream : AltWritableStream) {
    assert(() => !stream[K.IN_FLIGHT_WRITE_REQUEST]);
    assert(() => stream[K.WRITE_REQUESTS].length > 0);
    stream[K.IN_FLIGHT_WRITE_REQUEST] = stream[K.WRITE_REQUESTS].shift();
}

export function WritableStreamDefaultControllerClearAlgorithms(controller : AltWritableStreamDefaultController) {
    controller[K.WRITE_ALGORITHM] = undefined;
    controller[K.CLOSE_ALGORITHM] = undefined;
    controller[K.ABORT_ALGORITHM] = undefined;
    controller[K.STRATEGY_SIZE_ALGORITHM] = undefined;
}

export function WritableStreamFinishErroring(stream : AltWritableStream) {
    assert(() => stream[K.STATE] === 'erroring');
    assert(() => !WritableStreamHasOperationMarkedInFlight(stream));
    stream[K.STATE] = 'errored';
    stream[K.CONTROLLER][K.ERROR_STEPS]();

    let storedError = stream[K.STORED_ERROR];
    for (let request of stream[K.WRITE_REQUESTS]) {
        request.reject(storedError);
    }

    stream[K.WRITE_REQUESTS] = [];
    if (!stream[K.PENDING_ABORT_REQUEST]) {
        WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
        return;
    }

    let abortRequest = stream[K.PENDING_ABORT_REQUEST];
    stream[K.PENDING_ABORT_REQUEST] = undefined;

    if (abortRequest.wasAlreadyErroring) {
        abortRequest.promise.reject(storedError);
        WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
        return;
    }

    let promise = stream[K.CONTROLLER][K.ABORT_STEPS](abortRequest.reason);

    React(
        promise, 
        () => {
            abortRequest.promise.resolve();
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
        }, reason => {
            abortRequest.promise.reject(reason);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
        }
    );
}

export function WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream : AltWritableStream) {
    assert(() => stream[K.STATE] === 'errored');
    if (stream[K.CLOSE_REQUEST]) {
        assert(() => !stream[K.IN_FLIGHT_CLOSE_REQUEST]);
        stream[K.CLOSE_REQUEST].reject(stream[K.STORED_ERROR]);
        stream[K.CLOSE_REQUEST] = undefined;
    }

    let writer = stream[K.WRITER];
    if (writer) {
        writer[K.CLOSED].reject(stream[K.STORED_ERROR]).markHandled();
    }
}

export function WritableStreamDefaultControllerProcessWrite(
    controller : AltWritableStreamDefaultController, 
    chunk : ArrayBufferView
) {
    let stream = controller[K.STREAM];
    WritableStreamMarkFirstWriteRequestInFlight(stream);

    let sinkWritePromise = controller[K.WRITE_ALGORITHM](chunk);

    React(
        sinkWritePromise,
        () => {
            WritableStreamFinishInFlightWrite(stream);
            assert(() => ['writable', 'erroring'].includes(stream[K.STATE]));
            DequeueValue(controller);

            if (!WritableStreamCloseQueuedOrInFlight(stream) && stream[K.STATE] === 'writable')
                WritableStreamUpdateBackpressure(stream, WritableStreamDefaultControllerGetBackpressure(controller));

            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }, e => {
            if (stream[K.STATE] === 'writable')
                WritableStreamDefaultControllerClearAlgorithms(controller);
            
            WritableStreamFinishInFlightWriteWithError(stream, e);
        }
    );
}

export function WritableStreamFinishInFlightWrite(stream : AltWritableStream) {
    assert(() => !!stream[K.IN_FLIGHT_WRITE_REQUEST]);
    stream[K.IN_FLIGHT_WRITE_REQUEST].resolve();
    stream[K.IN_FLIGHT_WRITE_REQUEST] = undefined;
}

export function WritableStreamFinishInFlightWriteWithError(stream : AltWritableStream, error) {
    assert(() => !!stream[K.IN_FLIGHT_WRITE_REQUEST]);
    stream[K.IN_FLIGHT_WRITE_REQUEST].reject(error);
    stream[K.IN_FLIGHT_WRITE_REQUEST] = undefined;
    assert(() => ['writable', 'erroring'].includes(stream[K.STATE]));

    if (stream[K.STATE] === 'writable') {
        WritableStreamStartErroring(stream, error);
        return;
    }

    assert(() => stream[K.STATE] === 'erroring');
    WritableStreamFinishErroring(stream);
}

export function WritableStreamStartErroring(stream : AltWritableStream, reason) {
    assert(() => !stream[K.STORED_ERROR]);
    assert(() => stream[K.STATE] === 'writable');

    let controller = stream[K.CONTROLLER];
    assert(() => !!controller);
    stream[K.STATE] = 'erroring';
    stream[K.STORED_ERROR] = reason;

    let writer = stream[K.WRITER];
    if (writer)
        WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, reason);
    if (!WritableStreamHasOperationMarkedInFlight(stream) && controller[K.STARTED])
        WritableStreamFinishErroring(stream);
}

export function WritableStreamHasOperationMarkedInFlight(stream : AltWritableStream) {
    return !!(stream[K.IN_FLIGHT_WRITE_REQUEST] || stream[K.IN_FLIGHT_CLOSE_REQUEST]);
}

export function WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer : AltWritableStreamDefaultWriter, error) {
    if (writer[K.READY].state === 'pending') 
        writer[K.READY].reject(error);
    else
        writer[K.READY] = PromiseController.reject(error);

    writer[K.READY].markHandled();
}

export function WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer : AltWritableStreamDefaultWriter, error) {
    if (writer[K.CLOSED].state === 'pending')
        writer[K.CLOSED].reject(error);
    else
        writer[K.CLOSED] = PromiseController.reject(error);
    
    writer[K.CLOSED].markHandled();
}

export function WritableStreamAddWriteRequest(stream : AltWritableStream) {
    assert(() => stream.locked)
    assert(() => stream[K.STATE] === 'writable');
    let promise = new PromiseController();
    stream[K.WRITE_REQUESTS].push(promise);
    return promise;
}

export function IsWritableStreamLocked(stream : AltWritableStream) {
    return !!stream[K.WRITER];
}

export function IsReadableStreamLocked(stream : AltReadableStream) {
    return !!stream[K.READER];
}

export function WritableStreamClose(stream : AltWritableStream): Promise<void> {
    let state = stream[K.STATE];

    if (['closed', 'errored'].includes(state))
        return Promise.reject(new TypeError());

    assert(() => ['writable', 'erroring'].includes(state));
    assert(() => !WritableStreamCloseQueuedOrInFlight(stream));

    let promise = new PromiseController<void>();
    stream[K.CLOSE_REQUEST] = promise;

    let writer = stream[K.WRITER];

    if (writer && stream[K.BACKPRESSURE] && state === 'writable')
        writer[K.READY].resolve();

    WritableStreamDefaultControllerClose(stream[K.CONTROLLER]);

    return promise.promise;
}

export function WritableStreamDefaultControllerClose(controller : AltWritableStreamDefaultController) {
    EnqueueValueWithSize(controller, CLOSE_SENTINEL, 0);
    WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
}

export function WritableStreamDefaultControllerWrite(
    controller : AltWritableStreamDefaultController, 
    chunk : ArrayBufferView, 
    chunkSize : number
) {
    try {
        EnqueueValueWithSize(controller, chunk, chunkSize);
    } catch (e) {
        WritableStreamDefaultControllerErrorIfNeeded(controller, e);
        return;
    }

    let stream = controller[K.STREAM];

    if (!WritableStreamCloseQueuedOrInFlight(stream) && stream[K.STATE] === 'writable') {
        WritableStreamUpdateBackpressure(stream, WritableStreamDefaultControllerGetBackpressure(controller));
    }

    WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
}

export function WritableStreamDefaultControllerErrorIfNeeded(controller : AltWritableStreamDefaultController, error) {
    if (controller[K.STREAM][K.STATE] === 'writable')
        WritableStreamDefaultControllerError(controller, error);
}

export function WritableStreamDefaultControllerError(controller : AltWritableStreamDefaultController, error) {
    let stream = controller[K.STREAM];
    assert(() => stream[K.STATE] === 'writable');
    WritableStreamDefaultControllerClearAlgorithms(controller);
    WritableStreamStartErroring(stream, error);
}

export function WritableStreamDealWithRejection(stream : AltWritableStream, error) {
    let state = stream[K.STATE];
    if (state === 'writable') {
        WritableStreamStartErroring(stream, error);
        return;
    }

    assert(() => state === 'erroring');
    WritableStreamFinishErroring(stream);
}

export function WritableStreamDefaultControllerGetChunkSize(controller : AltWritableStreamDefaultController, chunk): number {
    try {
        return controller[K.STRATEGY_SIZE_ALGORITHM](chunk);
    } catch (e) {
        WritableStreamDefaultControllerErrorIfNeeded(controller, e);
        return 1;
    }
}

export function WritableStreamDefaultWriterAbort(writer : AltWritableStreamDefaultWriter, reason) {
    let stream = writer[K.STREAM];
    assert(() => !!stream);
    return WritableStreamAbort(stream, reason);
}

export function WritableStreamAbort(stream : AltWritableStream, reason): Promise<void> {
    if (['closed', 'errored'].includes(stream[K.STATE]))
        return Promise.resolve();
    (stream[K.CONTROLLER][K.SIGNAL_CONTROLLER] as AltAbortController).abort(reason ?? new DOMException('Aborted', 'AbortError'));
    let state = stream[K.STATE];
    if (['closed', 'errored'].includes(state))
        return Promise.resolve();
    if (stream[K.PENDING_ABORT_REQUEST]) {
        return stream[K.PENDING_ABORT_REQUEST].promise.promise;
    }
    assert(() => ['writable', 'erroring'].includes(state));
    let wasAlreadyErroring = false;
    if (state === 'erroring') {
        wasAlreadyErroring = true;
        reason = undefined;
    }

    let promise = new PromiseController();

    stream[K.PENDING_ABORT_REQUEST] = {
        promise, reason, wasAlreadyErroring
    };

    if (!wasAlreadyErroring)
        WritableStreamStartErroring(stream, reason);

    return promise.promise;
}

export function ExtractSizeAlgorithm(strategy : QueuingStrategy) {
    if (!strategy?.size)
        return (chunk : ArrayBufferView) => 1;
    if (typeof strategy.size !== 'function')
        throw new TypeError(`strategy.size must be a function`);

    let size = strategy.size;
    return (chunk : ArrayBufferView) => size(chunk);
}

export function ExtractHighWaterMark(strategy : QueuingStrategy, defaultHWM : number) {
    if (strategy?.highWaterMark === void 0)
        return defaultHWM;
    let highWaterMark = strategy?.highWaterMark;
    if (typeof highWaterMark !== 'number')
        highWaterMark = Number(highWaterMark);
    if (Number.isNaN(highWaterMark) || highWaterMark < 0)
        throw new RangeError();
    return highWaterMark;
}

export function WritableStreamDefaultWriterGetDesiredSize(writer : AltWritableStreamDefaultWriter) {
    let stream = writer[K.STREAM];
    let state = stream[K.STATE];

    if (['errored', 'erroring'].includes(state))
        return null;
    if (state === 'closed')
        return 0;

    return WritableStreamDefaultControllerGetDesiredSize(stream[K.CONTROLLER]);
}

export function WritableStreamDefaultWriterClose(writer : AltWritableStreamDefaultWriter) {
    let stream = writer[K.STREAM];
    assert(() => !!stream);
    return WritableStreamClose(stream);
}

export function WritableStreamDefaultWriterRelease(writer : AltWritableStreamDefaultWriter) {
    let stream = writer[K.STREAM];

    assert(() => !!stream);
    assert(() => stream[K.WRITER] === writer);

    let releasedError = new TypeError();

    WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, releasedError);
    WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, releasedError);
    stream[K.WRITER] = undefined;
    writer[K.STREAM] = undefined;
}

export function WritableStreamDefaultWriterWrite(writer : AltWritableStreamDefaultWriter, chunk) {
    let stream = writer[K.STREAM];
    assert(() => !!stream);

    let controller = stream[K.CONTROLLER];
    let chunkSize = WritableStreamDefaultControllerGetChunkSize(controller, chunk);
    if (stream[K.WRITER] !== writer)
        return Promise.reject(new TypeError());

    let state = stream[K.STATE];

    if (state === 'errored')
        return Promise.reject(stream[K.STORED_ERROR]);

    if (WritableStreamCloseQueuedOrInFlight(stream) || state === 'closed')
        return Promise.reject(new TypeError(`The stream is closing or already closed`));
    if (state === 'erroring')
        return Promise.reject(stream[K.STORED_ERROR]);
    
    assert(() => state === 'writable');
    let promise = WritableStreamAddWriteRequest(stream);

    WritableStreamDefaultControllerWrite(controller, chunk, chunkSize);
    return promise.promise;
}

export function WritableStreamDefaultWriterCloseWithErrorPropagation(writer : AltWritableStreamDefaultWriter) {
    let stream = writer[K.STREAM];
    assert(() => !!stream);
    let state = stream[K.STATE];
    if (WritableStreamCloseQueuedOrInFlight(stream) || state === 'closed')
        return Resolve();
    if (state === 'errored')
        return Reject(stream[K.STORED_ERROR]);
    assert(() => ['writable', 'erroring'].includes(state));
    
    return WritableStreamDefaultWriterClose(writer);
}

export function InitializeTransformStream(
    stream : AltTransformStream, 
    startPromise : Promise<void>, 
    writableHighWaterMark : number, 
    writableSizeAlgorithm: (chunk) => number,
    readableHighWaterMark : number,
    readableSizeAlgorithm: (chunk) => number
) {
    let startAlgorithm = () => startPromise;
    let writeAlgorithm = (chunk) => TransformStreamDefaultSinkWriteAlgorithm(stream, chunk);
    let abortAlgorithm = (reason) => TransformStreamDefaultSinkAbortAlgorithm(stream, reason);
    let closeAlgorithm = () => TransformStreamDefaultSinkCloseAlgorithm(stream);

    stream[K.WRITABLE] = new AltWritableStream(
        {
            start: startAlgorithm,
            write: writeAlgorithm,
            close: closeAlgorithm,
            abort: abortAlgorithm
        }, { 
            highWaterMark: writableHighWaterMark, 
            size: writableSizeAlgorithm
        }
    );

    let pullAlgorithm = () => TransformStreamDefaultSourcePullAlgorithm(stream);
    let cancelAlgorithm = reason => {
        TransformStreamErrorWritableAndUnblockWrite(stream, reason);
        return Promise.resolve();
    };

    stream[K.READABLE] = new AltReadableStream({
        start: startAlgorithm,
        pull: pullAlgorithm,
        cancel: cancelAlgorithm
    }, {
        highWaterMark: readableHighWaterMark,
        size: readableSizeAlgorithm
    });

    stream[K.BACKPRESSURE] = undefined;
    stream[K.BACKPRESSURE_CHANGE_PROMISE] = undefined;

    TransformStreamSetBackpressure(stream, true);
    stream[K.CONTROLLER] = undefined;
}

export function SetUpTransformStreamDefaultControllerFromTransformer(stream : AltTransformStream, transformer : Transformer) {
    let controller = new AltTransformStreamDefaultController();
    let transformAlgorithm = chunk => {
        try {
            TransformStreamDefaultControllerEnqueue(controller, chunk);
        } catch (e) {
            return Promise.reject(e);
        }

        return Promise.resolve();
    }

    let flushAlgorithm = (chunk) => Promise.resolve();
    if (transformer.transform) {
        transformAlgorithm = chunk => {
            try {
                Promise.resolve(Reflect.apply(transformer.transform, transformer, [chunk, controller]));
            } catch (e) {
                return Promise.reject(e);
            }
        };
    }

    if (transformer.flush) {
        flushAlgorithm = chunk => {
            try {
                Promise.resolve(Reflect.apply(transformer.flush, transformer, [chunk, controller]));
            } catch (e) {
                return Promise.reject(e);
            }
        }
    }

    SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm);
}

export function SetUpTransformStreamDefaultController(
    stream : AltTransformStream, 
    controller : AltTransformStreamDefaultController,
    transformAlgorithm : (chunk) => Promise<any>,
    flushAlgorithm : (chunk) => Promise<void>
) {
    assert(() => stream instanceof AltTransformStream);
    assert(() => !stream[K.CONTROLLER]);
    controller[K.STREAM] = stream;
    stream[K.CONTROLLER] = controller;
    controller[K.TRANSFORM_ALGORITHM] = transformAlgorithm;
    controller[K.FLUSH_ALGORITHM] = flushAlgorithm;
}

export function TransformStreamDefaultSourcePullAlgorithm(stream : AltTransformStream) {
    assert(() => stream[K.BACKPRESSURE]);
    assert(() => !!stream[K.BACKPRESSURE_CHANGE_PROMISE]);
    TransformStreamSetBackpressure(stream, false);
    return stream[K.BACKPRESSURE_CHANGE_PROMISE].promise;
}

export function TransformStreamErrorWritableAndUnblockWrite(stream : AltTransformStream, e) {
    TransformStreamDefaultControllerClearAlgorithms(stream[K.CONTROLLER]);
    WritableStreamDefaultControllerErrorIfNeeded(stream[K.WRITABLE][K.CONTROLLER], e);
    if (stream[K.BACKPRESSURE])
        TransformStreamSetBackpressure(stream, false);
}

export function TransformStreamDefaultControllerClearAlgorithms(controller : AltTransformStreamDefaultController) {
    controller[K.TRANSFORM_ALGORITHM] = undefined;
    controller[K.FLUSH_ALGORITHM] = undefined;
}

export function TransformStreamDefaultSinkWriteAlgorithm(stream : AltTransformStream, chunk) {
    assert(() => stream[K.WRITABLE][K.STATE] === 'writable');
    let controller = stream[K.CONTROLLER];
    if (stream[K.BACKPRESSURE]) {
        let backpressureChangePromise = stream[K.BACKPRESSURE_CHANGE_PROMISE];
        assert(() => !!backpressureChangePromise);
        return React(backpressureChangePromise, () => {
            let writable = stream[K.WRITABLE];
            let state = writable[K.STATE];
            if (state === 'erroring')
                throw writable[K.STORED_ERROR];
            assert(() => state === 'writable');
            return TransformStreamDefaultControllerPerformTransform(controller, chunk);
        });
    }

    return TransformStreamDefaultControllerPerformTransform(controller, chunk);
}

export function TransformStreamDefaultControllerPerformTransform(controller : AltTransformStreamDefaultController, chunk) {
    let transformPromise = controller[K.TRANSFORM_ALGORITHM](chunk);
    return Catch(transformPromise, r => {
        TransformStreamError(controller[K.STREAM], r);
        throw r;
    });
}

export function TransformStreamDefaultControllerTerminate(controller : AltTransformStreamDefaultController) {
    let stream = controller[K.STREAM];
    let readableController = <AltReadableStreamDefaultController> stream[K.READABLE][K.CONTROLLER];
    ReadableStreamDefaultControllerClose(readableController);
    let error = new TypeError(`The stream has been terminated`);
    TransformStreamErrorWritableAndUnblockWrite(stream, error);
}

export function TransformStreamDefaultSinkAbortAlgorithm(stream : AltTransformStream, reason) {
    TransformStreamError(stream, reason);
    return Promise.resolve();
}

export function TransformStreamError(stream : AltTransformStream, e) {
    ReadableStreamDefaultControllerError(<AltReadableStreamDefaultController>stream[K.READABLE][K.CONTROLLER], e);
    TransformStreamErrorWritableAndUnblockWrite(stream, e);
}

export function TransformStreamDefaultSinkCloseAlgorithm(stream : AltTransformStream) {
    let readable = stream[K.READABLE];
    let controller = stream[K.CONTROLLER];
    let flushPromise = controller[K.FLUSH_ALGORITHM]();
    TransformStreamDefaultControllerClearAlgorithms(controller);
    return React(flushPromise, () => {
        if (readable[K.STATE] === 'errored')
            throw readable[K.STORED_ERROR];
        ReadableStreamDefaultControllerClose(<AltReadableStreamDefaultController>readable[K.CONTROLLER]);
    }, r => {
        TransformStreamError(stream, r);
        throw readable[K.STORED_ERROR];
    });
}

export function TransformStreamDefaultControllerError(controller : AltTransformStreamDefaultController, e) {
    TransformStreamError(controller[K.STREAM], e);
}

export function TransformStreamDefaultControllerEnqueue(controller : AltTransformStreamDefaultController, chunk) {
    let stream = controller[K.STREAM];
    let readableController = <AltReadableStreamDefaultController> stream[K.READABLE][K.CONTROLLER];
    if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(readableController))
        throw new TypeError();
    try {
        let enqueueResult = ReadableStreamDefaultControllerEnqueue(readableController, chunk);
    } catch (e) {
        TransformStreamErrorWritableAndUnblockWrite(stream, e);
        throw stream[K.READABLE][K.STORED_ERROR];
    }

    let backpressure = ReadableStreamDefaultControllerHasBackpressure(readableController);
    if (backpressure !== stream[K.BACKPRESSURE]) {
        assert(() => backpressure);
        TransformStreamSetBackpressure(stream, true);
    }
}

export function TransformStreamSetBackpressure(stream : AltTransformStream, backpressure : boolean) {
    assert(() => stream[K.BACKPRESSURE] !== backpressure);
    if (stream[K.BACKPRESSURE_CHANGE_PROMISE])
        stream[K.BACKPRESSURE_CHANGE_PROMISE].resolve();
    stream[K.BACKPRESSURE_CHANGE_PROMISE] = new PromiseController();
    stream[K.BACKPRESSURE] = backpressure;
}

export function ReadableStreamDefaultControllerHasBackpressure(controller : AltReadableStreamDefaultController) {
    if (ReadableStreamDefaultControllerShouldCallPull(controller))
        return false;
    return true;
}