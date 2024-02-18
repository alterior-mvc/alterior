import { inject } from '@alterior/di';
import { Application, Constructor, ExecutionContext, RuntimeLogger } from '@alterior/runtime';

import { injectionContext } from '@alterior/di';
import { DEFAULT_LISTENERS } from './defaults';
import { LogEvent } from './log-event';
import { LogOptions } from './log-options';
import { LogSeverity } from './log-severity';
import { LOGGING_OPTIONS, LoggingOptions } from './logging-options';

export class Logger implements RuntimeLogger {
    protected options = inject(LOGGING_OPTIONS, { optional: true, allowMissingContext: true });
    protected app = inject(Application, { allowMissingContext: true });

    constructor();
    constructor(sourceLabel: string);
    constructor(sourceLabel: string, options: LoggingOptions);
    constructor(options: LoggingOptions);
    constructor(...args: any[]) {
        let options: LoggingOptions | undefined;
        let sourceLabel: string | undefined;

        if (typeof args[0] === 'string')
            sourceLabel = args.shift();

        if (typeof args[0] === 'object')
            options = args.shift();

        if (options)
            this.options = options;

        this.sourceLabel = sourceLabel ?? injectionContext({ optional: true })?.token?.name;
    }

    readonly sourceLabel: string | undefined;

    static readonly ZONE_LOCAL_NAME = '@alterior/logger:Logger.current';

    /**
     * Obtains the current logger by inspecting the current execution context. 
     * If no current logger is found, constructs a new logger and returns it.
     */
    public static get current(): Logger {
        return Zone.current.get(Logger.ZONE_LOCAL_NAME)
            ?? ExecutionContext.current?.application?.inject(Logger)
            ?? new Logger()
            ;
    }

    clone(sourceLabel?: string) {
        let logger = new (this.constructor as Constructor<this>)(sourceLabel ?? this.sourceLabel);

        logger.options = this.options;
        logger.app = this.app;

        return logger;
    }

    static log(message: string, data: Record<string, any>, severity: LogSeverity) { this.current.log(message, data, severity); }
    static info(message: string, data: Record<string, any>) { this.current.info(message, data); }
    static fatal(message: string, data: Record<string, any>) { this.current.fatal(message, data); }
    static debug(message: string, data: Record<string, any>) { this.current.debug(message, data); }
    static warning(message: string, data: Record<string, any>) { this.current.warning(message, data); }
    static error(message: string, data: Record<string, any>) { this.current.error(message, data); }

    get listeners() {
        if (this.options?.listeners) {
            return this.options.listeners;
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

    protected createMessage(message: Partial<LogEvent> & { message: string, severity: LogSeverity }): LogEvent {
        let contextSummary = this.contextLabel || '';

        if (this.sourceLabel)
            contextSummary = `${this.contextLabel ?? ''} » ${this.sourceLabel}`;

        return {
            type: 'message',
            context: this.context,
            date: new Date(),
            contextLabel: this.contextLabel,
            sourceLabel: this.sourceLabel,
            contextSummary: contextSummary,
            data: {},

            ...message
        };
    }

    log(message: string, data: Record<string, any>, severity: LogSeverity) {
        this.emitLog(this.createMessage({ message, data, severity }));
    }

    trace(message: string, data: Record<string, any> = {}) {
        this.log(message, data, 'trace');
    }

    info(message: string, data: Record<string, any> = {}) {
        this.log(message, data, 'info');
    }

    fatal(message: string, data: Record<string, any> = {}) {
        this.log(message, data, 'fatal');
    }

    debug(message: string, data: Record<string, any> = {}) {
        this.log(message, data, 'debug');
    }

    warning(message: string, data: Record<string, any> = {}) {
        this.log(message, data, 'warning');
    }

    error(message: string, data: Record<string, any> = {}) {
        this.log(message, data, 'error');
    }

    inspect(object: any, options?: LogOptions) {
        this.emitLog(this.createMessage({
            type: 'inspect',
            severity: (options ? options.severity : undefined) || 'info',
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

    withSource(sourceLabel: string | Object) {
        return this.clone(
            typeof sourceLabel === 'object' 
                ? sourceLabel.constructor.name 
                : String(sourceLabel)
        );
    }
}