export function assert(func : () => boolean) {
    if (!func())
        throw new Error(`Assertion failed: ${func.toString()}`);
}

export function copyDataBlockBytes(toBlock : ArrayBuffer, toIndex : number, fromBlock : ArrayBuffer, fromIndex : number, count : number) {
    new Uint8Array(toBlock).set(new Uint8Array(fromBlock).subarray(fromIndex, fromIndex + count), toIndex);
}

export interface ValueWithSize<T = any> {
    value : T;
    size : number;
}
