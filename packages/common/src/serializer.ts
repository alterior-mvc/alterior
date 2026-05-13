import { objectEntriesTyped } from "./object-entries-typed";

/**
 * Prepare an object for serialization by removing any fields which are undefined
 * or functions and return the result. The operation is recursive across all subobjects.
 * The original object is not modified.
 * 
 * @param data 
 */
export function prepareForSerialization<T>(data : T): T;
export function prepareForSerialization<T>(data : undefined): undefined;
export function prepareForSerialization<T>(data : null): null;
export function prepareForSerialization<T>(data : T | undefined): T | undefined;
export function prepareForSerialization<T>(data : T | null): T | null;
export function prepareForSerialization<T>(data : T | undefined | null): T | undefined | null;
export function prepareForSerialization<T>(data : T | undefined | null): T | undefined | null {
    if (data === undefined || data === null)
        return data;

    if ((data as any).toJSON)
        data = (data as any).toJSON();
    
    if (data === undefined || data === null)
        return data;

    if (typeof data !== 'object')
        return data;
    
    return objectEntriesTyped(data)
            .filter(x => x[1] !== undefined)
            .filter(x => typeof x[1] !== 'function')
            .map(x => [x[0], prepareForSerialization(x[1])] as const)
            .reduce((o, [k,v]) => (o[k] = v, o), <T>{})
    ;
}