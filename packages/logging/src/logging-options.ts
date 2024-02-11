import { LogListener } from "./log-listener";
import { LogSeverity } from "./log-severity";

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

    /**
     * Minimum severity to send to log listeners. Defaults to `info`. Logs less severe than this are discarded.
     */
    minimumSeverity?: LogSeverity;
}
