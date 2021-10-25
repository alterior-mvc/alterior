import { Module } from "@alterior/di";
import { Logger, LoggingOptions, LoggingOptionsRef } from "./logger";

@Module({
    providers: [
        Logger
    ]
})
export class LoggingModule {
    static configure(options : LoggingOptions = {}) {
        return LoggingModule.forRoot(options);
    }

    static forRoot(options : LoggingOptions = {}) {
        return { 
            $module: LoggingModule, 
            providers: [
                { provide: LoggingOptionsRef, useValue: new LoggingOptionsRef(options) }
            ]
        }
    }
}