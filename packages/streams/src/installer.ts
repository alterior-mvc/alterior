import { AltByteLengthQueuingStrategy } from "./byte-length-queuing-strategy";
import { AltAbortController, AltAbortSignal } from "./abort-controller";
import { AltCountQueuingStrategy } from "./count-queuing-strategy";
import { AltReadableStream, AltReadableStreamBYOBReader, AltReadableStreamDefaultController, AltReadableStreamBYOBRequest, AltReadableStreamDefaultReader, AltReadableByteStreamController } from "./readable-stream";
import { AltWritableStream, AltWritableStreamDefaultController, AltWritableStreamDefaultWriter } from "./writable-stream";
import { AltDOMException } from "./dom-exception";
import { AltTransformStream, AltTransformStreamDefaultController } from "./transform-stream";

export function installer(global? : typeof globalThis) {
    if (!global)
        global = globalThis;
    
    global.DOMException = AltDOMException;
    global.AbortController = AltAbortController;
    global.AbortSignal = AltAbortSignal;
    global.ReadableStream = AltReadableStream;
    global.ReadableStreamDefaultController = AltReadableStreamDefaultController;
    global.ReadableStreamBYOBReader = AltReadableStreamBYOBReader;
    global.ReadableStreamBYOBRequest = AltReadableStreamBYOBRequest;
    global.ReadableByteStreamController = AltReadableByteStreamController;
    global.ReadableStreamDefaultController = AltReadableStreamDefaultController;
    global.ReadableStreamDefaultReader = AltReadableStreamDefaultReader;

    global.WritableStream = AltWritableStream;
    global.WritableStreamDefaultController = AltWritableStreamDefaultController;
    global.WritableStreamDefaultWriter = AltWritableStreamDefaultWriter;
    global.CountQueuingStrategy = AltCountQueuingStrategy;
    global.ByteLengthQueuingStrategy = AltByteLengthQueuingStrategy;

    global.TransformStream = AltTransformStream;
    global.TransformStreamDefaultController = AltTransformStreamDefaultController;
}