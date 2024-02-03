/**
 * Prepare an object for serialization by removing any fields which are undefined
 * or functions and return the result. The operation is recursive across all subobjects.
 * The original object is not modified.
 * 
 * @param data 
 */
export function prepareForSerialization<T>(data : null): null;
export function prepareForSerialization<T>(data : undefined): undefined;
export function prepareForSerialization<T>(data : T): T;
export function prepareForSerialization<T>(data : any): T | null | undefined {
    if (data === undefined || data === null)
        return data;

    if (typeof data === 'object' && 'toJSON' in data && typeof data.toJSON === 'function') {
        data = data.toJSON();
    }
    
    if (typeof data !== 'object')
        return data;
    
    return (Object.entries(data) as [keyof T, unknown][])
            .filter(x => x[1] !== undefined)
            .filter(x => typeof x[1] !== 'function')
            .map(x => [x[0], prepareForSerialization(x[1])] as const)
            .reduce((o, [k,v]) => ((o as any)[k] = v, o), <T>{})
    ;
}