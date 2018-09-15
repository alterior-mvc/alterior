function objectToPairs(obj) {
    return Object.keys(obj).map(x => [x, obj[x]]);
}

function pairsToObject<T>(pairs : any[]): T {
    let obj : any = {};
    pairs.forEach(x => obj[x[0]] = x[1]);
    return obj;
}

export function prepareForSerialization<T>(data : T): T {
    if (data === undefined || data === null)
        return null;

    if (data['toJSON'])
        data = data['toJSON']();
    
    if (typeof data !== 'object')
        return data;
    
    return pairsToObject<T>(
        objectToPairs(data)
            .filter(x => x[1] !== undefined)
            .filter(x => typeof x[1] !== 'function')
            .map(x => [x[0], prepareForSerialization(x[1])])
    );
}