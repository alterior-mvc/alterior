import { LogEvent } from "./log-event";

export type LogFormat = string | ((event: LogEvent) => string);
