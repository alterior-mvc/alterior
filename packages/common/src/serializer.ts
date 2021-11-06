/**
 * Prepare an object for serialization by removing any fields which are undefined
 * or functions and return the result. The operation is recursive across all subobjects.
 * The original object is not modified.
 * 
 * @param data 
 */
export function prepareForSerialization<T>(data : T): T {
    if (data === undefined || data === null)
        return null;

    if (data['toJSON'])
        data = data['toJSON']();
    
    if (typeof data !== 'object')
        return data;
    
    return Object.entries(data)
            .filter(x => x[1] !== undefined)
            .filter(x => typeof x[1] !== 'function')
            .map(x => [x[0], prepareForSerialization(x[1])])
            .reduce((o, [k,v]) => (o[k] = v, o), <T>{})
    ;
}