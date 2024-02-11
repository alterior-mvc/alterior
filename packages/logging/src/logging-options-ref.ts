import { ExecutionContext } from "@alterior/runtime";
import { LoggingOptions } from "./logging-options";

export class LoggingOptionsRef {
    constructor(readonly options: LoggingOptions) {
    }

    public static get currentRef(): LoggingOptionsRef | undefined {
        return ExecutionContext.current?.application?.inject(LoggingOptionsRef, null) || undefined;
    }

    public static get current(): LoggingOptions {
        return this.currentRef?.options ?? {};
    }
}
