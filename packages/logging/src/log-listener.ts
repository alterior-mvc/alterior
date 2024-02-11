import { LogEvent } from "./log-event";

export interface LogListener {
    log(message: LogEvent): Promise<void>;
}