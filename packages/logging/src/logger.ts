import { Injectable } from '@alterior/di';

export type LogSeverity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

import * as fs from 'fs';

export class LoggingOptionsRef {
    constructor(readonly options : LoggingOptions) {
    }
}

export interface LogOptions {
    severity : LogSeverity;
}

export interface LogMessage {
    message : string;
    context : any;
    contextLabel : string;
    sourceLabel : string;
    severity : LogSeverity;
    date : Date;
}

export interface LogListener {
    log(message : LogMessage) : Promise<void>;
}

export const DEFAULT_FORMAT = '';

export interface FormatSegment {
    type : "raw" | "parameter";
    value : string;
}

export class LogFormatter {
    constructor(readonly formatString : string) {
        this.compile();
    }

    private compile() {
        let segment = '';
        let segments : FormatSegment[] = [];

        for (let i = 0, max = this.formatString.length; i < max; ++i) {
            let char = this.formatString[i];

            if (char == '%') {
                let lookAhead = this.formatString.substr(i + 1);

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

    segments : FormatSegment[] = [];

    public format(message : LogMessage) : string {
        return this.segments.map(x => x.type == 'parameter' ? message[x.value] : x.value).join('');
    }
}

export class ConsoleLogger implements LogListener {
    constructor(
        readonly format : string
    ) {
        this.formatter = new LogFormatter(format);
    }

    private formatter : LogFormatter;

    async log(message : LogMessage) {
        console.log(this.formatter.format(message));
    }
}

export class FileLogger implements LogListener {
    constructor(
        readonly format : string,
        readonly filename : string
    ) {
        this.formatter = new LogFormatter(format);
    }

    private formatter : LogFormatter;
    private _fdReady : Promise<number>;

    get ready() {
        return this._fdReady;
    }

    async open() {
        if (this._fdReady)
            return await this._fdReady;

        await (this._fdReady = new Promise((res, rej) => {
            fs.open(this.filename, 'a', (err, fd) => {
                if (err)
                    rej(err);
                else
                    res(fd);
            });
        }));
    }

    async write(str : string) {
        let fd = await this.open();
        await new Promise<void>((res, rej) => {
            fs.write(fd, new Buffer(str), (err, written, buffer) => {
                if (err) {
                    rej(err);
                    return;
                }
                
                // sync to flush this to disk right away
                fs.fdatasync(fd, (err) => err ? rej(err) : res());
            });
        });
    }

    async log(message : LogMessage) {
        let formattedMessage = this.formatter.format(message);
        await this.write(`${formattedMessage}\n`);
    }
}

export interface LoggingOptions {
    listeners? : LogListener[];
}

@Injectable()
export class Logger {
    constructor(private optionsRef : LoggingOptionsRef) {
        if (optionsRef && optionsRef.options) {
            if (optionsRef.options.listeners)
                this._listeners = optionsRef.options.listeners;
        }

        if (!this._listeners) {
            this._listeners = [ new ConsoleLogger(DEFAULT_FORMAT) ];
        }
    }

    private _listeners : LogListener[];
    private _sourceLabel : string = undefined;

    get sourceLabel() {
        return this._sourceLabel;
    }

    get listeners() {
        return this._listeners || [];
    }
    
    clone() {
        let logger = new Logger(this.optionsRef);
        Object.keys(this).filter(x => typeof this[x] !== 'function').forEach(key => logger[key] = this[key]);
        return logger;
    }

    withSource(sourceLabel : string) {
        let logger = this.clone();
        logger._sourceLabel = sourceLabel;

        return logger;
    }

    withContext(context : any, label : string, callback : Function) {
        let zone = Zone.current.fork({
            name: `LogContextZone: ${label}`,
            properties: {
                logContext: context,
                logContextLabel: label
            }
        });

        zone.run(() => callback());
    }

    get context() {
        return Zone.current.get('logContext');
    }

    get contextLabel() {
        return Zone.current.get('logContextLabel');
    }

    log(message : string, options? : LogOptions) {
        this.emitLog({
            context: this.context,
            contextLabel: this.contextLabel,
            date: new Date(),
            message,
            severity: (options ? options.severity : undefined) || 'info',
            sourceLabel: this._sourceLabel
        });
    }

    info(message : string, options? : LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'info' }));
    }

    debug(message : string, options? : LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'debug' }));
    }
    
    warning(message : string, options? : LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'warning' }));
    }
    
    error(message : string, options? : LogOptions) {
        this.log(message, Object.assign({}, options, { severity: 'error' }));
    }

    private emitLog(message : LogMessage) {
        this.listeners.forEach(listener => listener.log(message));
    }
}