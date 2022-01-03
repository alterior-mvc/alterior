import * as K from './symbols';

export class AssertionError extends Error {}

export function assert(func : () => boolean) {
    if (!func())
        throw new AssertionError(`Assertion failed: ${func.toString()}`);
}

export function CopyDataBlockBytes(toBlock : ArrayBuffer, toIndex : number, fromBlock : ArrayBuffer, fromIndex : number, count : number) {
    new Uint8Array(toBlock).set(new Uint8Array(fromBlock).subarray(fromIndex, fromIndex + count), toIndex);
}

export interface ValueWithSize<T = any> {
    value : T;
    size : number;
}

export interface QueueWithSizes<T> {
    [K.QUEUE] : ValueWithSize<T>[];
    [K.QUEUE_TOTAL_SIZE] : number;
}

export function DequeueValue<T = any>(queue : QueueWithSizes<T>): T {
    assert(() => queue[K.QUEUE].length > 0);
    let valueWithSize = queue[K.QUEUE].shift();
    queue[K.QUEUE_TOTAL_SIZE] -= valueWithSize.size;
    if (queue[K.QUEUE_TOTAL_SIZE] < 0)
        queue[K.QUEUE_TOTAL_SIZE] = 0;
    
    return valueWithSize.value;
}

export function EnqueueValueWithSize<T>(queue : QueueWithSizes<T>, value : T, size : number) {
    if (typeof size !== 'number' || Number.isNaN(size) || !Number.isFinite(size) || size < 0)
        throw new RangeError(`Invalid value size`);

    queue[K.QUEUE].push({ value, size });
    queue[K.QUEUE_TOTAL_SIZE] += size;
}

export function PeekQueueValue<T>(queue : QueueWithSizes<T>): T {
    assert(() => queue[K.QUEUE].length > 0);
    return queue[K.QUEUE][0].value;
}

export function ResetQueue<T = any>(queue : QueueWithSizes<T>) {
    queue[K.QUEUE] = [];
    queue[K.QUEUE_TOTAL_SIZE] = 0;
}

let PromiseThen = Promise.prototype.then;
let PromiseResolve = Promise.resolve;
let PromiseReject = Promise.reject;
let PromiseAll = Promise.all;

export function React<T, U = void>(promise : T | PromiseLike<T>, resolved : (t : T) => U | PromiseLike<U>, rejected? : (e) => any): Promise<U> {
    let orig = promise;

    if (!promise || !(Promise instanceof Promise))
        promise = Resolve(<any>promise);
    
    try {
        return Reflect.apply(PromiseThen, promise, [ resolved, rejected ]);
    } catch (e) {
        console.error(`FAIL: original:`);
        console.dir(orig);
        console.error(`CTOR: ${orig.constructor.name}`);

        console.error(`FILTERED:`);
        console.dir(promise);
        console.error(`CTOR: ${promise.constructor.name}`);

        throw e;
    }
}

export function Catch<T>(promise : T | PromiseLike<T>, rejected? : (e) => any) {
    return React(promise, undefined, rejected);
}

export function Resolve<T = void>(t? : T): Promise<T> {
    return Reflect.apply(PromiseResolve, Promise, [ t ]);
}

export function Reject(e): Promise<any> {
    return Reflect.apply(PromiseReject, Promise, [ e ]);
}

export function All<T>(promises : Promise<T>[]): Promise<T[]> {
    return Reflect.apply(PromiseAll, Promise, [ promises ]);
}

export function Loop(step : () => Promise<boolean>) {
    return new Promise<void>((resolveLoop, rejectLoop) => {
        function next(done : boolean) {
            if (done) {
                resolveLoop();
            } else {
                React(step(), next, rejectLoop);
            }
        }

        next(false);
    });
}

export function RethrowAssertionErrorRejection(error) {
    if (error && error instanceof AssertionError) {
        setTimeout(() => {
            throw error;
        }, 0);
    }
}

/**
 * Some rejected promises may not be observed by the user, and that doesn't mean 
 * we should trigger unhandled-promise-rejection logic. So we avoid that by adding a 
 * catch to any such promise, referred to in the spec as "Set promise.[[PromiseIsHandled]] to true"
 * @param promise 
 */
export function SetPromiseIsHandledToTrue(promise : Promise<any>) {
    React(promise, undefined, RethrowAssertionErrorRejection);
}

export function RejectHandled(v) {
    let p = Reject(v);
    SetPromiseIsHandledToTrue(p);
    return p;
}