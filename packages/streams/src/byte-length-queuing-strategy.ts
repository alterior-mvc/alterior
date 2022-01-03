export class AltByteLengthQueuingStrategy implements ByteLengthQueuingStrategy {
    constructor(options: { highWaterMark: number }) {
        if (!options)
            throw new TypeError(`Must provide options.`);
        if (!('highWaterMark' in options))
            throw new TypeError(`Options must include highWaterMark`);
        
        this.#highWaterMark = options?.highWaterMark;
    }

    #highWaterMark : number;

    get highWaterMark() {
        return this.#highWaterMark;
    }

    size(chunk: ArrayBufferView) { return chunk.byteLength; };
}