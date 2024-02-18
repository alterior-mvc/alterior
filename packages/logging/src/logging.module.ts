import { Module } from "@alterior/runtime";
import { Logger } from "./logger";
import { LOGGING_OPTIONS, LoggingOptions } from "./logging-options";

@Module({
    providers: [
        { provide: Logger, useClass: Logger, unique: false }
    ]
})
export class LoggingModule {
    static configure(options : LoggingOptions = {}) {
        return { 
            $module: LoggingModule, 
            providers: [
                { provide: LOGGING_OPTIONS, useValue: options }
            ]
        }
    }
}