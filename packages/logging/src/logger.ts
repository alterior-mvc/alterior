import { Injectable, Optional, Skip } from '@alterior/di';
import { ExecutionContext, Application, Constructor } from '@alterior/runtime';

export type LogSeverity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

import * as fs from 'fs';
import { inspect, stylizeWithConsoleColors } from './inspect';

export class LoggingOptionsRef {
    constructor(readonly options: LoggingOptions) {
    }

    public static get currentRef(): LoggingOptionsRef | null {
        if (!ExecutionContext.current || !ExecutionContext.current.application)
           return null;

        return ExecutionContext.current.application.inject(LoggingOptionsRef);
    }

    public static get current(): LoggingOptions {
        let ref = this.currentRef;
        return ref ? ref.options: {};
    }
}

export interface LogOptions {
    severity: LogSeverity;
}

export interface LogEvent {
    type: 'message' | 'inspect';
    message: string;

    /**
     * Subject being inspected. Defined
     * only for `type == 'inspect'`
     */
    subject?: any;

    /**
     * Context data, if any
     */
    context?: any;

    /**
     * Context label, if set
     */
    contextLabel?: string;

    /**
     * Source label, if set.
     */
    sourceLabel?: string;

    /**
     * Context summary
     */
    contextSummary?: string;

    /**
     * Severity of the log event.
     */
    severity: LogSeverity;

    /**
     * The date when the log event was recorded.
     */
    date: Date;
}

export interface LogListener {
    log(message: LogEvent): Promise<void>;
}

export interface FormatSegment {
    type: "raw" | "parameter";
    value: string;
}

export class LogFormatter {
    constructor(readonly logFormat: LogFormat) {
        this.compile();
    }

    private compile() {
        if (typeof this.logFormat === 'function')
            return;

        let segment = '';
        let segments: FormatSegment[] = [];

        for (let i = 0, max = this.logFormat.length; i < max; ++i) {
            let char = this.logFormat[i];

            if (char == '%') {
                let lookAhead = this.logFormat.substr(i + 1);

                if (lookAhead.includes('%')) {

                    if (segment != '') {
                        segments.push({ type: 'raw', value: segment });
                        segment = '';
                    }

                    let parameterName = lookAhead.replace(/%.*$/, '');
                    i += parameterName.length + 1;

                    segments.push({ type: 'parameter', value: parameterName });

                } else {
                    segment += char;
                }
            } else {
                segment += char;
            }
        }

        if (segment !== '') {
            segments.push({ type: 'raw', value: segment });
        }

        this.segments = segments;
    }

    segments: FormatSegment[] = [];

    private formatParameter(name: string, value: Object) {
        if (value === true || value === false)
            return value ? '«true»': '«false»';
        
        if (value === null)
            return '«null»';
            
        if (value === undefined)
            return '«undefined»';

        if (value instanceof Date)
            return value.toISOString();

        return value.toString();
    }

    public format(message: LogEvent): string {
        if (typeof this.logFormat === 'function')
            return this.logFormat(message);
           
        return this.segments
            .map(x => x.type == 'parameter' 
                ? this.formatParameter(x.value, message[x.value as keyof LogEvent])
                : x.value
            )
            .join('')
        ;
    }
}

export class ConsoleLogger implements LogListener {
    constructor(
        readonly format: LogFormat
    ) {
        this.formatter = new LogFormatter(format);
    }

    private formatter: LogFormatter;

    async log(message: LogEvent) {
        let messageText = message.message;

        if (message.type === 'inspect') {

            // On the web, take advantage of the interactive
            // inspection facilities

            if (typeof document !== 'undefined') {
                console.dir(message.subject);
                return;
            } 

            // Inspect

            messageText = inspect(message.subject, {
                stylize: stylizeWithConsoleColors
            });
        }

        let finalMessage = Object.assign({}, message, { message: messageText });
        let finalMessageStr = this.formatter.format(finalMessage);
        console.log(finalMessageStr);
    }
}

export type LogFormat = string | ((event: LogEvent) => string);

export class FileLogger implements LogListener {
    constructor(
        readonly format: LogFormat,
        readonly filename: string
    ) {
        this.formatter = new LogFormatter(format);
    }

    private formatter: LogFormatter;
    private _fdReady: Promise<number> | undefined;

    get ready() {
        return this._fdReady;
    }

    async open() {
        if (this._fdReady)
            return await this._fdReady;

        return await (this._fdReady = new Promise((res, rej) => {
            fs.open(this.filename, 'a', (err, fd) => {
                if (err)
                    rej(err);
                else
                    res(fd);
            });
        }));
    }

    async write(str: string) {
        let fd = await this.open();
        await new Promise<void>((res, rej) => {
            fs.write(fd, Buffer.from(str), (err, written, buffer) => {
                if (err) {
                    rej(err);
                    return;
                }
                
                // sync to flush this to disk right away
                fs.fdatasync(fd, (err) => err ? rej(err): res());
            });
        });
    }

    async log(message: LogEvent) {
        let formattedMessage = this.formatter.format(message);
        await this.write(`${formattedMessage}\n`);
    }
}

export interface LoggingOptions {
    /**
     * Specify functions which listen to and in some way handle
     * emitted log messages.
     */
    listeners?: LogListener[];

    /**
     * Whether to enable tracing as provided by @ConsoleTrace.
     */
    tracing?: boolean;
}

export class ZonedLogger {
    constructor(
        @Optional() protected optionsRef?: LoggingOptionsRef,
        protected app?: Application,
        sourceLabel?: string
    ) {
        this._sourceLabel = sourceLabel;
    }
    
    clone() {
        return new (this.constructor as Constructor<this>)(this.optionsRef, this.app, this._sourceLabel);
    }

    protected _sourceLabel?: string;

    get sourceLabel() {
        return this._sourceLabel;
    }

    static readonly ZONE_LOCAL_NAME = '@alterior/logger:Logger.current';

    public static get current(): ZonedLogger {
        return Zone.current.get(Logger.ZONE_LOCAL_NAME) 
            ?? ExecutionContext.current?.application?.inject(Logger)
            ?? new ZonedLogger()
        ;
    }

    static log(message: string, options?: LogOptions) { this.current.log(message, options); }
    static info(message: string, options?: LogOptions) { this.current.log(message, options); }
    static fatal(message: string, options?: LogOptions) { this.current.fatal(message, options); }
    static debug(message: string, options?: LogOptions) { this.current.log(message, options); }
    static warning(message: string, options?: LogOptions) { this.current.log(message, options); }
    static error(message: string, options?: LogOptions) { this.current.log(message, options); }

    get listeners() {
        if (this.optionsRef?.options?.listeners) {
            return this.optionsRef.options.listeners;
        }

        if (this.app?.options?.silent)
            return [];
        
        return DEFAULT_LISTENERS;
    }

    /**
     * Run the given function with this logger as the current logger. 
     * Calls to Logger.current will yield the logger for this execution
     * context.
     */
    run(func: Function): any {
        return Zone.current.fork({
            name: `LoggerContext`,
            properties: {
                [Logger.ZONE_LOCAL_NAME]: this
            }
        }).run(func);
    }

    protected createMessage(message: Partial<LogEvent>): LogEvent {
        let contextSummary = this.contextLabel || '';

        if (this._sourceLabel)
            contextSummary = `${contextSummary} » ${this._sourceLabel}`;

        return <LogEvent>Object.assign(<Partial<LogEvent>>{
            type: 'message',
            context: this.context,
            date: new Date(),
            message,
            contextLabel: this.contextLabel,
            sourceLabel: this._sourceLabel,
            contextSummary: contextSummary
        }, message);
    }
    
    log(message: string, options?: LogOptions) {
        this.emitLog(this.createMessage({
            message,
            severity: (options ? options.severity: undefined) || 'info'
        }));
    }

    info(message: string, options?: LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'info' }));
    }

    fatal(message: string, options?: LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'fatal' }));
    }

    debug(message: string, options?: LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'debug' }));
    }
    
    warning(message: string, options?: LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'warning' }));
    }
    
    error(message: string, options?: LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'error' }));
    }

    inspect(object: any, options?: LogOptions) {
        this.emitLog(this.createMessage({
            type: 'inspect',
            severity: (options ? options.severity: undefined) || 'info',
            subject: object,
            message: '' + object
        }))
    }

    private emitLog(message: LogEvent) {
        this.listeners.forEach(listener => listener.log(message));
    }

    get context() {
        return Zone.current.get('logContext');
    }

    get contextLabel() {
        return Zone.current.get('logContextLabel');
    }

    async withContext<T = any>(context: any, label: string, callback: () => T): Promise<T> {
        let zone = Zone.current.fork({
            name: `LogContextZone: ${label}`,
            properties: {
                logContext: context,
                logContextLabel: label
            }
        });

        return await zone.run<T>(() => callback());
    }
}

@Injectable()
export class Logger extends ZonedLogger {
    constructor(
        @Optional() optionsRef?: LoggingOptionsRef,
        app?: Application,
        @Skip() sourceLabel?: string
    ) {
        super(optionsRef, app, sourceLabel);
    }

    withSource(sourceLabel: string | Object) {
        let logger = this.clone();

        if (typeof sourceLabel === 'string') {
            logger._sourceLabel = sourceLabel;    
        } else if (typeof sourceLabel === 'object') {
            logger._sourceLabel = sourceLabel.constructor.name;
        } else {
            logger._sourceLabel = `${sourceLabel}`;
        }

        return logger;
    }
}

export const DEFAULT_FORMAT: LogFormat = (event: LogEvent) => {
    if (event.contextSummary)
        return `${event.date.toISOString()} [${event.contextSummary}] ${event.severity}: ${event.message}`;
    else
        return `${event.date.toISOString()} ${event.severity}: ${event.message}`;
};

export const DEFAULT_LISTENERS: LogListener[] = [ new ConsoleLogger(DEFAULT_FORMAT) ];
