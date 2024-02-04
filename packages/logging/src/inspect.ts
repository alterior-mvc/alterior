/**
 * Module exports.
 */

import { ConsoleColors } from '@alterior/common';

export interface InspectOptions {
    stylize: (str: string, styleType: string) => any;
    depth?: number;
    colors?: boolean;
    showHidden?: boolean;
    customInspect?: boolean;
}

interface Context extends InspectOptions {
    seen: any[];
}

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 * @license MIT (© Joyent)
 */
/* legacy: obj, showHidden, depth, colors*/


export function inspect(obj : any, opts? : InspectOptions): string {
    // default options

    let ctx: Context = {
        seen: [],
        stylize: stylizeNothing
    };

    if (opts)
        Object.assign(ctx, opts);

    // set default options
    if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
    if (isUndefined(ctx.depth)) ctx.depth = 2;
    if (isUndefined(ctx.colors)) ctx.colors = false;
    if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
    if (ctx.colors) ctx.stylize = stylizeWithConsoleColors;

    return formatValue(ctx, obj, ctx.depth);
}

// Don't use 'blue' not visible on cmd.exe
const CONSOLE_COLOR_STYLES = {
    'special': 'cyan',
    'number': 'yellow',
    'boolean': 'yellow',
    'undefined': 'grey',
    'null': 'bold',
    'string': 'green',
    'date': 'magenta',
    // "name": intentionally not styling
    'regexp': 'red'
};

/**
 * Pass the string through with no stylization.
 */
export function stylizeNothing(str: string, styleType: string) {
    return str;
}

function isBoolean(arg: unknown): arg is boolean {
    return typeof arg === 'boolean';
}

function isUndefined(arg: unknown): arg is undefined {
    return arg === void 0;
}

/**
 * Use console colors to style the string. Suitable for output to
 * terminals with ANSI color support.
 */
export function stylizeWithConsoleColors(str: string, styleType: string) {
    let style = CONSOLE_COLOR_STYLES[styleType as keyof typeof CONSOLE_COLOR_STYLES];
    return style ? ConsoleColors[style as keyof typeof ConsoleColors](str) : str;
}

function isFunction(arg: unknown): arg is Function {
    return typeof arg === 'function';
}

function isString(arg: unknown): arg is string {
    return typeof arg === 'string';
}

function isNumber(arg: unknown): arg is number {
    return typeof arg === 'number';
}

function isNull(arg: unknown): arg is null {
    return arg === null;
}

function hasOwn(obj: object, prop: string) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

function isRegExp(re: unknown): re is RegExp {
    return re instanceof RegExp;
}

function isObject(arg: unknown): arg is object {
    return typeof arg === 'object' && arg !== null;
}

function isError(e: unknown): e is Error {
    return isObject(e) && e instanceof Error;
}

function isDate(d: unknown): d is Date {
    return isObject(d) && d instanceof Date;
}

function arrayToHash(array: any[]) {
    let hash: Record<string, boolean> = {};

    array.forEach(val => hash[val] = true);

    return hash;
}

function formatArray(ctx: Context, value: unknown[], recurseTimes: number | null, visibleKeys: Record<string, boolean>, keys: string[]) {
    let output = [];
    for (let i = 0, l = value.length; i < l; ++i) {
        if (hasOwn(value, String(i))) {
            output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                String(i), true));
        } else {
            output.push('');
        }
    }
    keys.forEach(function (key) {
        if (!key.match(/^\d+$/)) {
            output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                key, true));
        }
    });
    return output;
}

function formatError(value: Error) {
    return '[' + Error.prototype.toString.call(value) + ']';
}

function formatValue(ctx: Context, value: any, recurseTimes: number | null): string {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (ctx.customInspect &&
        value &&
        isFunction(value.inspect) &&
        // Filter out the util module, it's inspect function is special
        value.inspect !== inspect &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
        let ret = value.inspect(recurseTimes, ctx);
        if (!isString(ret)) {
            ret = formatValue(ctx, ret, recurseTimes);
        }
        return ret;
    }

    // Primitive types cannot have properties
    let primitive = formatPrimitive(ctx, value);
    if (primitive) {
        return primitive;
    }

    // Look up the keys of the object.
    let keys = Object.keys(value);
    let visibleKeys = arrayToHash(keys);

    try {
        if (ctx.showHidden && Object.getOwnPropertyNames) {
            keys = Object.getOwnPropertyNames(value);
        }
    } catch (e) {
        // ignore
    }

    // IE doesn't make error fields non-enumerable
    // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
    if (isError(value)
        && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
        return formatError(value);
    }

    // Some type of object without properties can be shortcutted.
    if (keys.length === 0) {
        if (isFunction(value)) {
            let name = value.name ? ': ' + value.name : '';
            return ctx.stylize('[Function' + name + ']', 'special');
        }
        if (isRegExp(value)) {
            return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        }
        if (isDate(value)) {
            return ctx.stylize(Date.prototype.toString.call(value), 'date');
        }
        if (isError(value)) {
            return formatError(value);
        }
    }

    let base = '', array = false, braces = ['{', '}'];

    // Make Array say that they are Array
    if (Array.isArray(value)) {
        array = true;
        braces = ['[', ']'];
    }

    // Make functions say that they are functions
    if (isFunction(value)) {
        let n = value.name ? ': ' + value.name : '';
        base = ' [Function' + n + ']';
    }

    // Make RegExps say that they are RegExps
    if (isRegExp(value)) {
        base = ' ' + RegExp.prototype.toString.call(value);
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
        base = ' ' + Date.prototype.toUTCString.call(value);
    }

    // Make error with message first say the error
    if (isError(value)) {
        base = ' ' + formatError(value);
    }

    if (keys.length === 0 && (!array || value.length === 0)) {
        return braces[0] + base + braces[1];
    }

    if ((recurseTimes || 0) < 0) {
        if (isRegExp(value)) {
            return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        } else {
            return ctx.stylize('[Object]', 'special');
        }
    }

    ctx.seen.push(value);

    let output;
    if (array) {
        output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
    } else {
        output = keys.map(function (key) {
            return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
        });
    }

    ctx.seen.pop();

    return reduceToSingleString(output, base, braces);
}

function formatProperty(ctx: Context, value: any, recurseTimes: number | null, visibleKeys: Record<string, boolean>, key: string, array: boolean): string {
    let name;
    let desc = Object.getOwnPropertyDescriptor(value, key) ?? { value: value[key] };
    let str: string | undefined;

    if (desc.get) {
        if (desc.set) {
            str = ctx.stylize('[Getter/Setter]', 'special');
        } else {
            str = ctx.stylize('[Getter]', 'special');
        }
    } else {
        if (desc.set) {
            str = ctx.stylize('[Setter]', 'special');
        }
    }
    if (!hasOwn(visibleKeys, key)) {
        name = '[' + key + ']';
    }
    if (!str) {
        if (ctx.seen.indexOf(desc.value) < 0) {
            if (isNull(recurseTimes)) {
                str = formatValue(ctx, desc.value, null);
            } else {
                str = formatValue(ctx, desc.value, recurseTimes - 1);
            }
            if (str.indexOf('\n') > -1) {
                if (array) {
                    str = str.split('\n').map(line => {
                        return '    ' + line;
                    }).join('\n').substr(2);
                } else {
                    str = '\n' + str.split('\n').map(function (line) {
                        return '     ' + line;
                    }).join('\n');
                }
            }
        } else {
            str = ctx.stylize('[Circular]', 'special');
        }
    }
    if (isUndefined(name)) {
        if (array && key.match(/^\d+$/)) {
            return str!;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
            name = name.substr(1, name.length - 2);
            name = ctx.stylize(name, 'name');
        } else {
            name = name.replace(/'/g, "\\'")
                .replace(/\\"/g, '"')
                .replace(/(^"|"$)/g, "'");
            name = ctx.stylize(name, 'string');
        }
    }

    return name + ': ' + str;
}

function formatPrimitive(ctx: Context, value: unknown) {
    if (isUndefined(value))
        return ctx.stylize('undefined', 'undefined');
    if (isString(value)) {
        let simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
            .replace(/'/g, "\\'")
            .replace(/\\"/g, '"') + '\'';
        return ctx.stylize(simple, 'string');
    }
    if (isNumber(value))
        return ctx.stylize('' + value, 'number');
    if (isBoolean(value))
        return ctx.stylize('' + value, 'boolean');
    // For some reason typeof null is "object", so special case here.
    if (isNull(value))
        return ctx.stylize('null', 'null');
}

function reduceToSingleString(output: string[], base: string, braces: string[]) {
    let numLinesEst = 0;
    let length = output.reduce(function (prev, cur) {
        numLinesEst++;
        if (cur.indexOf('\n') >= 0) numLinesEst++;
        return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
    }, 0);

    if (length > 60) {
        return braces[0] +
            (base === '' ? '' : base + '\n ') +
            ' ' +
            output.join(',\n    ') +
            ' ' +
            braces[1];
    }

    return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}