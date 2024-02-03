
export interface Console {
    log(...args : any[]): void;
    info(...args : any[]): void;
    warn(...args : any[]): void;
    error(...args : any[]): void;
    debug(...args : any[]): void;
    dir(...args : any[]): void;
}

function safeRequire(name : string) {
    if (typeof require === 'undefined')
        return undefined;
       
    try {
        return require(name);
    } catch (e) {
        return undefined;
    }
}

/**
 * Intercept console messages emitted within the given function, allowing you to programmatically call the underlying raw console implementation (or not).
 * 
 * @param handler 
 * @param callback 
 */
export function interceptConsole(handler : (method : string, originalImpl : Function, console : Console, args : any[]) => void, callback : Function) {
    let methods = [ 'log', 'info', 'warn', 'error', 'debug', 'dir' ] as const as (keyof Console)[];

    let rawConsole : Console = {} as any;
    let origConsole = {} as typeof console;
    
    for (let method of methods) {
        origConsole[method] = console[method];
        rawConsole[method] = (console[method] || console.log).bind(console);
        console[method] = function() {
            handler(method, rawConsole[method], rawConsole, Array.from(arguments));
        };
    }

    try {
        callback();
    } finally {
        for (let method of methods)
            console[method] = origConsole[method];
    }
}

/**
 * Intercept all console messages emitted within the given function and indent them with 
 * the given number of spaces before printing them out.
 * 
 * @param spaces 
 * @param callback 
 */
export function indentConsole(spaces : number, callback : Function) {
    let indent = Array(spaces).join(' ');

    return interceptConsole((method, original, console, args) => {
        if (method == 'dir') {
            const util = safeRequire('util');
            if (util)
                console.log(`${indent}${util.inspect(args[0])}`)
            else
                original(...args);
        } else {
            original(`${indent}${args.join(' ')}`);
        }
    }, callback);
}

/**
 * Intercept all console messages emitted within the given function and format them using the given formatter before 
 * printing them.
 * 
 * @param formatter 
 * @param callback 
 */
export function formatConsole(formatter : (message : string) => string, callback : Function) {
    return interceptConsole((method, original, console, args) => {
        if (method == 'dir') {
            const util = safeRequire('util');
            if (util) {
                console.log(`${formatter(util.inspect(args[0]))}`)
            } else {
                original(...args);
            }
        } else {
            original(`${formatter(args.join(' '))}`);
        }
    }, callback);
}