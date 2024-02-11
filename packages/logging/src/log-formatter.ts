import { FormatSegment } from "./format-segment";
import { LogEvent } from "./log-event";
import { LogFormat } from "./log-format";

/**
 * Responsible for applying a given log format to log events, producing a single string which can be sent by a LogListener.
 * 
 */
export class LogFormatter {
    constructor(readonly logFormat: LogFormat) {
        this.compile();
    }

    private compile() {
        if (typeof this.logFormat === 'function')
            return;

        let segment = '';
        let segments: FormatSegment[] = [];

        for (let i = 0, max = this.logFormat.length; i < max; ++i) {
            let char = this.logFormat[i];

            if (char == '%') {
                let lookAhead = this.logFormat.substr(i + 1);

                if (lookAhead.includes('%')) {

                    if (segment != '') {
                        segments.push({ type: 'raw', value: segment });
                        segment = '';
                    }

                    let parameterName = lookAhead.replace(/%.*$/, '');
                    i += parameterName.length + 1;

                    segments.push({ type: 'parameter', value: parameterName });

                } else {
                    segment += char;
                }
            } else {
                segment += char;
            }
        }

        if (segment !== '') {
            segments.push({ type: 'raw', value: segment });
        }

        this.segments = segments;
    }

    segments: FormatSegment[] = [];

    private formatParameter(name: string, value: Object) {
        if (value === true || value === false)
            return value ? '«true»': '«false»';
        
        if (value === null)
            return '«null»';
            
        if (value === undefined)
            return '«undefined»';

        if (value instanceof Date)
            return value.toISOString();

        return value.toString();
    }

    public format(message: LogEvent): string {
        if (typeof this.logFormat === 'function')
            return this.logFormat(message);
           
        return this.segments.map(x => x.type == 'parameter' ? this.formatParameter(x.value, message[x.value as keyof LogEvent]): x.value).join('');
    }
}
