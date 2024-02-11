import { StyledString, style, styled } from "@alterior/terminal";
import { ConsoleLogger } from "./console-logger";
import { LogEvent } from "./log-event";
import { LogListener } from "./log-listener";
import { leftPad, rightPad, zeroPad } from "@alterior/functions";
import { LogFormat } from "./log-format";

export const PLAIN_FORMAT: LogFormat = (event: LogEvent) => {
    if (event.contextSummary)
        return `${event.date.toISOString()} [${event.contextSummary}] ${event.severity}: ${event.message}`;
    else
        return `${event.date.toISOString()} ${event.severity}: ${event.message}`;
};

export const DEFAULT_FORMAT: LogFormat = (event: LogEvent) => {
    let message: StyledString;
    let severityIndicator = '  ';

    if (typeof event.message !== 'string') {
        event.message = String(event.message);
    }

    if (event.message?.startsWith('✅ ')) {
        severityIndicator = '✅';
        message = style.$green(event.message.replace(/^✅ /, ''));
    } else {
        switch (event.severity) {
            case 'info':
                message = style.$white(event.message);
                severityIndicator = '  ';
                break;
            case 'debug':
                message = style.$gray(event.message);
                severityIndicator = '  ';
                break;
            case 'trace':
                message = style.$gray(event.message);
                severityIndicator = '  ';
            case 'error':
                message = style.$red(event.message);
                severityIndicator = '🟥';
                break;
            case 'warning':
                message = style.$bold(style.$yellow(event.message));
                severityIndicator = '🟨';
                break;
            case 'fatal':
                message = style.$bold(style.$red(event.message))
                severityIndicator = '⛔';
                break;
            default:
                event.severity satisfies never;
                message = style(event.message);
        }
    }

    let identStr = event.contextSummary ?? '';
    let dateStr = formatDate(event.date);

    return styled(
        style.$gray(dateStr ? `${dateStr} ` : ``),
        style.$magenta(`${leftPad(String(process.pid), 6)}`),
        ' ',
        style.$green(rightPad(identStr, 18)),
        ' ',
        style.$gray(severityIndicator),
        ' ',
        message
    )

    function formatDate(date: Date) {
        if (process.env.ARC_ENV === 'development') {
            return '';
        } else {
            if (process.env.ARC_SERVER_TIME_FORMAT === 'iso') {
                return date.toISOString();
            } else {
                let hour = date.getHours() === 0 ? 12 : date.getHours() > 12 ? date.getHours() - 12 : date.getHours();
                let ampm = date.getHours() >= 12 ? 'PM' : 'AM';
                let year = date.getFullYear();
                let month = date.getMonth() + 1;
                let day = date.getDate();
                let minute = date.getMinutes();
                let seconds = date.getSeconds();

                return `${zeroPad(year)}-${zeroPad(month)}-${zeroPad(day)} ${zeroPad(hour)}:${zeroPad(minute)}:${zeroPad(seconds)} ${ampm}`;
            }
        }
    }
};

export const DEFAULT_LISTENERS: LogListener[] = [new ConsoleLogger(DEFAULT_FORMAT)];
