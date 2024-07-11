import { Mutator } from "@alterior/annotations";
import { ConsoleColors, coalesce, indentConsole } from '@alterior/common';
import { ExecutionContext } from "@alterior/runtime";
import { Logger } from "./logger";
import { LOGGING_OPTIONS } from "./logging-options";

let ENABLED : boolean = false;

export function getTracingEnabled() {
    return ENABLED;
}

export function setTracingEnabled(enabled : boolean) {
    ENABLED = enabled;
}

/**
 * Prints messages related to the execution of the decorated method
 * to the console. 
 * 
 * - When multiple traced functions are involved, the output is indented 
 *   appropriately. 
 * - Intercepts console messages from within the function to add 
 *   appropriate indentation.
 * - Records (and rethrows) exceptions thrown from within the function.
 * - For methods returning promises, the promise itself is traced,
 *   printing a "Resolved" message upon completion or a "Rejected"
 *   message upon rejection.
 * 
 * Note that this functionality can be enabled and disabled by configuring
 * the `tracing` option when configuring this module for your application. 
 * When @Trace() is used outside of an Alterior execution context, the trace 
 * logs are always enabled, and the default log listeners are used.
 * 
 * For example, given a class:
 * 
 * ```
 * class Thing {
 *     @Trace()
 *     static doSomething(data : any, stuff : number) {
 *         console.log("Almost...");
 *         try {
 *             this.anotherSomething(stuff);
 *         } catch (e) {
 * 
 *         }
 *     }
 *     @Trace()
 *     static anotherSomething(stuff : number) {
 *         console.log("Nah...");
 *         throw new Error('Uh oh');
 *     }
 * }
 * ```
 * 
 *  * When executed, one may see:
 * 
 * ```sh
 * Thing#doSomething({"stuff":321,"other":"nice"}, 12333) {
 * Almost...
 * Thing#anotherSomething(12333) {
 *    Nah...
 *    (!!) Exception:
 *         Error: Uh oh
 * } // [Exception] Thing#anotherSomething(12333)
 * } // [Done, 6ms] Thing#doSomething({"stuff":321,"other":"nice"}, 12333)
 * ```
 * 
 */
export function Trace() {
    return Mutator.define({
        options: { 
            validTargets: ['method'] 
        },

        invoke(site) {

            // - When used outside of Alterior, we will *always trace*.
            // - When used inside an Alterior app, we will not trace by default.
            // - If optionsRef.options.tracing is set to true, we trace.

            let options = ExecutionContext.current?.application?.inject(LOGGING_OPTIONS, null);
            let enabled = options ? coalesce(options.tracing, false) : true;
            let logger = Logger.current;

            if (!enabled)
                return;

            if (!ENABLED)
                return;
            
            let originalMethod : Function = site.propertyDescriptor!.value;
            site.propertyDescriptor!.value = function (...args: any[]) {
                let type : Function;
                let isStatic : boolean = false;

                if (typeof site.target === 'function') {
                    type = site.target;
                    isStatic = true;
                } else {
                    type = site.target.constructor;
                    isStatic = false;
                }
                
                let typeName : string;
                let sep : string = '.';

                if (isStatic)
                    sep = '#';

                typeName = type.name;

                let startedAt = Date.now();

                let argStrings = [];

                for (let arg of args) {
                    if (arg === null)
                        argStrings.push('null');
                    else if (arg === undefined)
                        argStrings.push('undefined');
                    else if (arg === true)
                        argStrings.push('true');
                    else if (arg === false)
                        argStrings.push('false');
                    else if (typeof arg === 'string') 
                        argStrings.push(JSON.stringify(arg));
                    else if (typeof arg === 'function')
                        argStrings.push(arg.name);
                    else if (typeof arg === 'object')
                        argStrings.push(JSON.stringify(arg))
                    else 
                        argStrings.push(''+arg);
                }

                let methodSpec = `${ConsoleColors.cyan(`${typeName}${sep}${site.propertyKey}`)}(${argStrings.join(', ')})`;
                logger.debug(`${methodSpec} {`);
                let value: any;

                let finish = (message?: string) => {
                    let time = Date.now() - startedAt;
                    let components = [message ?? ConsoleColors.green(`Done`)];
                    let timingColor = (m: string) => m;
                    let showTiming = time > 3;

                    if (time > 20) {
                        timingColor = ConsoleColors.red;
                    } else if (time > 5) {
                        timingColor = ConsoleColors.yellow;
                    }
                    
                    if (showTiming) {
                        components.push(timingColor(`${time}ms`));
                    }

                    logger.debug(`} // [${components.join(', ')}] ${methodSpec}`);
                };

                try {
                    indentConsole(4, () => {
                        try {
                            value = originalMethod.apply(this, args); 
                        } catch (e) {
                            console.error(`${ConsoleColors.red(`(!!)`)} Exception:`);
                            indentConsole(6, () => console.error(e));
                            
                            throw e;
                        }
                    });
                } catch (e) {
                    finish(ConsoleColors.red(`Exception`));
                    throw e;
                }
                
                if (value?.then) {
                    let promise : Promise<any> = value;
                    value = promise.then(() => {
                        finish(ConsoleColors.green(`Resolved`));
                    }).catch(e => {
                        finish(ConsoleColors.red(`Rejected (${e})`));
                        throw e;
                    });
                } else {
                    finish();
                }

                return value;
            };
        }
    });
}

/**
 * If an exception occurs within the target method, report that exception to the console and rethrow.
 */
export function ReportExceptionsToConsole() {
    return Mutator.define({
        options: { 
            validTargets: ['method'] 
        },

        invoke(site) {
            let originalMethod : Function = site.propertyDescriptor!.value;
            site.propertyDescriptor!.value = function (...args: any[]) {
                let type : Function;
                let isStatic : boolean = false;

                if (typeof site.target === 'function') {
                    type = site.target;
                    isStatic = true;
                } else {
                    type = site.target.constructor;
                    isStatic = false;
                }
                
                let typeName : string;
                let sep : string = '.';

                if (isStatic)
                    sep = '#';

                typeName = type.name;

                try {
                    return originalMethod.apply(this, args);
                } catch (e) {
                    console.error(`Error occurred during ${typeName}${sep}${site.propertyKey}():`);
                    console.error(e);
                    throw e;
                }
            };
        }
    });
}
