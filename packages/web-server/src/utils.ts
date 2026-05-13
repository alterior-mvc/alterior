
export function ellipsize(maxLength: number, str: string): string {
    if (str.length > maxLength)
        return str.slice(0, maxLength) + '...';

    return str;
}

export function addToHeadersInit(headersInit: HeadersInit, key: string, value: string) {
    if (!headersInit)
        throw new Error(`Cannot add a header to null/undefined headersInit object`);

    if (Array.isArray(headersInit))
        headersInit.push([key, value]);
    else if (headersInit instanceof Headers)
        headersInit.set(key, value);
    else if (typeof headersInit === 'object')
        headersInit[key] = value;
}

export const altFetch: typeof fetch = 
    typeof fetch !== 'undefined' ? fetch
        : require('node-fetch');

if (!altFetch)
    throw new Error(`No fetch() implementation available. Please install node-fetch or upgrade your Node.js version.`);