import { Module } from "@alterior/di";
import { Logger } from "./logger";
import { LoggingOptions } from "./logging-options";
import { LoggingOptionsRef } from "./logging-options-ref";

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
                { provide: LoggingOptionsRef, useValue: new LoggingOptionsRef(options) }
            ]
        }
    }
}