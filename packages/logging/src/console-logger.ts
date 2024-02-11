import { inspect, stylizeWithConsoleColors } from "./inspect";
import { LogEvent } from "./log-event";
import { LogFormat } from "./log-format";
import { LogFormatter } from "./log-formatter";
import { LogListener } from "./log-listener";

export class ConsoleLogger implements LogListener {
    constructor(
        readonly format: LogFormat
    ) {
        this.formatter = new LogFormatter(format);
    }

    private formatter: LogFormatter;

    async log(message: LogEvent) {
        let messageText = message.message;

        if (message.type === 'inspect') {

            // On the web, take advantage of the interactive
            // inspection facilities

            if (typeof document !== 'undefined') {
                console.dir(message.subject);
                return;
            } 

            // Inspect

            messageText = inspect(message.subject, {
                stylize: stylizeWithConsoleColors
            });
        }

        let finalMessage = Object.assign({}, message, { message: messageText });
        let finalMessageStr = this.formatter.format(finalMessage);
        console.log(finalMessageStr);
    }
}
