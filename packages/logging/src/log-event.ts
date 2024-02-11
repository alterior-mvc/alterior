import { LogSeverity } from "./log-severity";

export interface LogEvent {
    type: 'message' | 'inspect';

    /**
     * Message string associated with the log event. This should summarize the log event without requiring 
     * the viewer to inspect the included structured data.
     */
    message: string;

    /**
     * Structured data associated with the log event. 
     */
    data: Record<string, any>;

    /**
     * Subject being inspected. Defined
     * only for `type == 'inspect'`
     */
    subject?: any;

    /**
     * Context data, if any. This is data which is associated with the current execution context,
     * and crosscuts an individual logging source (such as a class). For example, you can use this to track 
     * the current web request across many different classes, all logging while working to provide a response.
     * 
     * Context is set by running code via Logger.withContext().
     */
    context?: any;

    /**
     * Context label, if set. This is a string representation of the current context, suitable for use in 
     * text-only logging formats.
     * 
     * Context is set by running code via Logger.withContext().
     */
    contextLabel?: string;

    /**
     * Source label, if set. This is typically name of the class outputting the log event, but can be arbitrary,
     * or not provided.
     * 
     * Source label is provided in the Logger constructor (or automatically when using `inject(Logger)`).
     */
    sourceLabel?: string;

    /**
     * Combines the context summary and source label into a single string value (separated by a right angle quote).
     * This is useful for simple template-based log formatters which want to include both sourceLabel and contextLabel, 
     * but wish to avoid showing an empty source label when the information is not available.
     * 
     * Source label is provided in the Logger constructor (or automatically when using `inject(Logger)`).
     * Context is set by running code via Logger.withContext().
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
