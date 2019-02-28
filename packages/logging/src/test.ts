import { suite } from 'razmin';
import { Logger, LoggingOptionsRef, ConsoleLogger, FileLogger, LogFormatter, LogMessage } from './logger';
import { expect } from 'chai';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const SAMPLE_LOG_MESSAGE_1 : LogMessage = { message: 'ABCDEF', date: new Date(), severity: 'info', context: null, contextLabel: null, sourceLabel: null };
const SAMPLE_LOG_MESSAGE_2 : LogMessage = { message: '123456', date: new Date(), severity: 'info', context: null, contextLabel: null, sourceLabel: null };
const SAMPLE_LOG_MESSAGE_3 : LogMessage = { message: 'TUVXYZ', date: new Date(), severity: 'info', context: null, contextLabel: null, sourceLabel: null };

function SAMPLE_LOG_MESSAGE(message) : LogMessage {
    return { 
        message, 
        date: new Date(), 
        severity: 'info', 
        context: null, 
        contextLabel: null, 
        sourceLabel: null 
    };
}

function SAMPLE_LOG_MESSAGE_FATAL(message) : LogMessage {
    return { 
        message, 
        date: new Date(), 
        severity: 'fatal', 
        context: null, 
        contextLabel: null, 
        sourceLabel: null 
    };
}

suite(describe => {
    describe('Logger', it => {
        it('calls each listener', async () => {
            let result = '';
            let logger = new Logger(new LoggingOptionsRef({
                listeners: [
                    { async log(message) { result += `a${message.message}`; } },
                    { async log(message) { result += `b${message.message}`; } }
                ]
            }));

            await logger.log('X');
            await logger.log('Y');

            expect(result).to.eq('aXbXaYbY');
        });

        it('defaults to ConsoleLogger', async () => {
            let logger = new Logger(undefined);
            let logger2 = new Logger(new LoggingOptionsRef({ }));


            expect(logger.listeners.length).to.eq(1);
            expect(logger.listeners[0].constructor).to.equal(ConsoleLogger);
            expect(logger2.listeners.length).to.eq(1);
            expect(logger2.listeners[0].constructor).to.equal(ConsoleLogger);
        });

        it('supports execution-based context', async () => {
            let logger = new Logger(new LoggingOptionsRef({ listeners: [] }));

            expect(logger.context).to.not.exist;
            expect(logger.contextLabel).to.not.exist;

            logger.withContext({ abc: 123 }, 'contextlabel', () => {
                expect(logger.context.abc).to.eq(123);
                expect(logger.contextLabel).to.eq('contextlabel');
                setTimeout(() => {
                    expect(logger.context.abc).to.eq(123);
                    expect(logger.contextLabel).to.eq('contextlabel');
                }, 10);
            });

            expect(logger.context).to.not.exist;
            expect(logger.contextLabel).to.not.exist;

            logger.withContext({ abc: 321 }, 'contextlabel2', () => {
                expect(logger.context.abc).to.eq(321);
                expect(logger.contextLabel).to.eq('contextlabel2');
                setTimeout(() => {
                    expect(logger.context.abc).to.eq(321);
                    expect(logger.contextLabel).to.eq('contextlabel2');
                }, 10);
            });

            expect(logger.context).to.not.exist;
            expect(logger.contextLabel).to.not.exist;
        });

        it('supports child loggers with a specific source', async () => {
            let logger = new Logger(new LoggingOptionsRef({ listeners: [] }));

            expect(logger.sourceLabel).to.not.exist;

            let sublogger = logger.withSource('athing');

            expect(sublogger.sourceLabel).to.eq('athing');
            expect(logger.sourceLabel).to.not.exist;
        });
    });

    describe('FileLogger', it => {

        it('basically works', async () => {
            
            let filename = path.join(os.tmpdir(), `file-logger-test-${Math.floor(Math.random() * 100000)}.txt`);

            if (fs.existsSync(filename))
                fs.unlinkSync(filename);

            console.log(filename);
            let logger = new FileLogger('%severity%|%message%', filename);

            await logger.open();

            await logger.log({ message: 'TUVXYZ', date: new Date(), severity: 'info', context: null, contextLabel: null, sourceLabel: null });
            
            let contents2 = fs.readFileSync(filename).toString().split(/\n/g);

            await logger.log({ message: '123456', date: new Date(), severity: 'info', context: null, contextLabel: null, sourceLabel: null });
            
            let contents3 = fs.readFileSync(filename).toString().split(/\n/g);

            if (fs.existsSync(filename))
                fs.unlinkSync(filename);

            expect(contents2[0]).to.eq('info|TUVXYZ');
            expect(contents3[0]).to.eq('info|TUVXYZ');
            expect(contents3[1]).to.eq('info|123456');
            
            // make sure there's nothing extra
            expect(contents2.length).to.eq(2);
            expect(contents3.length).to.eq(3);
        });
    });

    describe('LogFormatter', it => {
        it('parses an empty string, ergo always produces empty strings', () => {
            let formatter = new LogFormatter('');

            expect(formatter.format(SAMPLE_LOG_MESSAGE(''))).to.equal('');
            expect(formatter.format(SAMPLE_LOG_MESSAGE('abcdef'))).to.equal('');
            expect(formatter.format(SAMPLE_LOG_MESSAGE('stuff!'))).to.equal('');
        });

        it('parses a literal string, ergo always produces the literal string', () => {
            let formatter = new LogFormatter('a silly format');

            expect(formatter.format(SAMPLE_LOG_MESSAGE(''))).to.equal('a silly format');
            expect(formatter.format(SAMPLE_LOG_MESSAGE('abcdef'))).to.equal('a silly format');
            expect(formatter.format(SAMPLE_LOG_MESSAGE('stuff!'))).to.equal('a silly format');
        });

        it('parses variables and substitutes message fields', () => {
            let formatter = new LogFormatter('-%severity%- -%message%-');

            expect(formatter.format(SAMPLE_LOG_MESSAGE('one silly message'))).to.equal('-info- -one silly message-');
            expect(formatter.format(SAMPLE_LOG_MESSAGE_FATAL('another silly message'))).to.equal('-fatal- -another silly message-');
            expect(formatter.format(SAMPLE_LOG_MESSAGE(''))).to.equal('-info- --');
        });
    });

    describe('ConsoleLogger', it => {
        
        function patchConsole(buffer : string[]) {
            let originalLog;
            function patch() {
                originalLog = console.log;
                console.log = message => {
                    buffer.push(message)
                };
            }

            function unpatch() {
                console.log = originalLog;
            }

            let zone = Zone.current.fork({
                name: 'ConsoleLoggerTestZone',
                onInvoke(parent, current, target, callback, applyThis, applyArgs, source) {
                    try {
                        patch();
                        parent.invoke(target, callback, applyThis, applyArgs, source);
                    } finally {
                        unpatch();
                    }
                },
                onInvokeTask(parent: ZoneDelegate, current: Zone, target: Zone, task: Task, applyThis: any, applyArgs: any) {
                    try {
                        patch();
                        parent.invokeTask(target, task, applyThis, applyArgs);
                    } finally {
                        unpatch();
                    }
                }
            });

            return zone;
        }

        it('should obey silly formats', () => {
            let buffer = [];
            patchConsole(buffer)
                .run(() => {
                    let logger = new ConsoleLogger('ABCDEF');
                    logger.log(SAMPLE_LOG_MESSAGE_3);
                    logger.log(SAMPLE_LOG_MESSAGE_2);
                })
            ;

            expect(buffer.length).to.eq(2);
            expect(buffer[0]).to.eq('ABCDEF');
            expect(buffer[1]).to.eq('ABCDEF');
        })

        it('should understand format variable substitution', () => {
            let buffer = [];
            patchConsole(buffer)
                .run(() => {
                    let logger = new ConsoleLogger('%severity%|%message%');
                    logger.log(SAMPLE_LOG_MESSAGE_3);
                    logger.log(SAMPLE_LOG_MESSAGE_2);
                })
            ;

            expect(buffer.length).to.eq(2);
            expect(buffer[0]).to.eq('info|TUVXYZ');
            expect(buffer[1]).to.eq('info|123456');
        })
    })
});