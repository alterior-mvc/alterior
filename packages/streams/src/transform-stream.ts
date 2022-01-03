import * as K from './symbols';
import * as Op from './abstract-ops';
import { PromiseController } from './promise-controller';
import { AltReadableStream, AltReadableStreamDefaultController } from './readable-stream';
import { AltWritableStream } from './writable-stream';

export class AltTransformStreamDefaultController<O = any> implements TransformStreamDefaultController<O> {
    [K.FLUSH_ALGORITHM];
    [K.TRANSFORM_ALGORITHM];
    [K.STREAM] : AltTransformStream;

    get desiredSize() {
        let readableController = <AltReadableStreamDefaultController>this[K.STREAM][K.READABLE][K.CONTROLLER];
        return Op.ReadableStreamDefaultControllerGetDesiredSize(readableController);
    }

    enqueue(chunk: any): void {
        Op.TransformStreamDefaultControllerEnqueue(this, chunk);
    }

    error(reason?: any): void {
        Op.TransformStreamDefaultControllerError(this, reason);
    }

    terminate(): void {
        Op.TransformStreamDefaultControllerTerminate(this);
    }
}

export class AltTransformStream<I = any, O = any> implements TransformStream<I,O> {
    constructor(
        transformer: Transformer<I, O> = null, 
        writableStrategy?: QueuingStrategy<I>, 
        readableStrategy?: QueuingStrategy<O>
    ) {
        if (transformer?.readableType)
            throw new RangeError();
        if (transformer?.writableType)
            throw new RangeError();
        
        let readableHighWaterMark = Op.ExtractHighWaterMark(readableStrategy, 0);
        let readableSizeAlgorithm = Op.ExtractSizeAlgorithm(readableStrategy);
        let writableHighWaterMark = Op.ExtractHighWaterMark(writableStrategy, 0);
        let writableSizeAlgorithm = Op.ExtractSizeAlgorithm(writableStrategy);

        let startPromise = new PromiseController();

        Op.InitializeTransformStream(
            this, startPromise.promise, writableHighWaterMark, writableSizeAlgorithm, 
            readableHighWaterMark, readableSizeAlgorithm
        );

        Op.SetUpTransformStreamDefaultControllerFromTransformer(this, transformer);

        if (transformer?.start) {
            startPromise.resolve(Reflect.apply(transformer.start, transformer, [ this[K.CONTROLLER] ]));
        } else {
            startPromise.resolve();
        }
    }

    [K.READABLE] : AltReadableStream<O>;
    [K.WRITABLE] : AltWritableStream<I>;
    [K.CONTROLLER] : AltTransformStreamDefaultController;
    [K.BACKPRESSURE] : boolean;
    [K.BACKPRESSURE_CHANGE_PROMISE] : PromiseController<void>;

    get readable(): ReadableStream<O> { return this[K.READABLE]; }
    get writable(): WritableStream<I> { return this[K.WRITABLE]; }
}