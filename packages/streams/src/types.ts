import { PromiseController } from "promise-controller";

export interface ReadIntoRequest {
    chunk : (chunk) => void;
    close : (chunk) => void;
    error : (value) => void;
}

export interface ReadRequest {
    chunk : (chunk) => void;
    close : () => void;
    error : (value) => void;
}


export interface PullIntoDescriptor {
    buffer : ArrayBuffer;
    bufferByteLength : number;
    byteOffset : number;
    byteLength : number;
    bytesFilled : number;
    elementSize : number;
    viewConstructor : Function;
    readerType : 'default' | 'byob';
}

export interface ReadableByteStreamQueueEntry {
    buffer : ArrayBuffer;
    byteOffset : number;
    byteLength : number;
}

export interface PendingAbortRequest {
    promise : PromiseController;
    reason;
    wasAlreadyErroring : boolean;
}
