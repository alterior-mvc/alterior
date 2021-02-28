import { CommandLineProcessor } from "./command-line-processor";
import { after, before, describe } from "razmin";
import { expect } from "chai";
import { StringTerminalDriver, TerminalDriverSelector } from "./terminal";

describe('CommandLineProcessor', it => {
    let terminalDriver = new StringTerminalDriver();
    let processor = new CommandLineProcessor();
    let exitCode : number;

    before(() => {
        TerminalDriverSelector.default = terminalDriver;
        terminalDriver.buffer = '';
        processor = new CommandLineProcessor();
        processor.exit = (code : number) => exitCode = code;
        exitCode = undefined;
    })

    after(() => {
        TerminalDriverSelector.default = null;
    });

    it('allows options to be defined', () => {
        processor.option({
            id: 'hello',
            short: 'h',
            description: 'Hello'
        });
    });
    it('sets options to not present before .process()', () => {
        processor.option({
            id: 'hello',
            short: 'h',
            description: 'Hello'
        });
        expect(processor.option('hello').present).to.be.false;
    });
    it('allows options to be used', () => {
        processor.option({
            id: 'hello',
            short: 'h',
            description: 'Hello'
        });

        processor.process([]);
        expect(processor.option('hello').present).to.be.false;
        processor.process(['--hello']);
        expect(processor.option('hello').present).to.be.true;
    });
    it('resets options on each .process() call', () => {
        processor.option({
            id: 'hello',
            short: 'h',
            description: 'Hello'
        });

        processor.process(['--hello']);
        expect(processor.option('hello').present).to.be.true;
        processor.process([]);
        expect(processor.option('hello').present).to.be.false;
    });
    it('allows the short version of an option to be used', () => {
        processor.option({
            id: 'hello',
            short: 'H',
            description: 'Hello'
        });

        expect(processor.option('hello').present).to.be.false;
        processor.process(['-H']);
        expect(processor.option('hello').present).to.be.true;
    });
    it('allows options to take values', () => {
        processor.option({
            id: 'hello',
            short: 'H',
            description: 'Hello',
            valueHint: 'place'
        });

        expect(processor.option('hello').present).to.be.false;
        expect(processor.option('hello').value).not.to.exist;
        processor.process(['--hello', 'world']);
        expect(processor.option('hello').present).to.be.true;
        expect(processor.option('hello').value).to.equal('world');
    });
    it('executes commands when invoked', () => {
        let executed = false;
        processor.command('hello', cmd => cmd.run(args => executed = true));
        processor.process(['hello']);
        expect(executed).to.be.true;
        expect(processor.arguments).to.eql([]);
    });
    it('does not execute commands that are not invoked', () => {
        let executed = 0;
        processor.command('hello', cmd => cmd.run(args => executed += 1));
        processor.command('world', cmd => cmd.run(args => executed += 2));
        processor.process(['hello']);
        expect(executed).to.equal(1);
        expect(processor.arguments).to.eql([]);
    });
    it('executes no commands when none are invoked', () => {
        let executed = 0;
        processor.command('hello', cmd => cmd.run(args => executed += 1));
        processor.command('world', cmd => cmd.run(args => executed += 2));
        processor.process([]);
        expect(executed).to.equal(0);
        expect(processor.arguments).to.eql([]);
    });
    it('passes command subarguments', () => {
        let executed = false;
        let receivedArgs : string[];
        processor.command('hello', cmd => cmd.run(args => (receivedArgs = args, executed = true)));
        processor.process(['hello', 'world']);
        expect(executed).to.be.true;
        expect(receivedArgs).to.eql(['world']);
        expect(processor.arguments).to.eql([]);
    });
    it('allows command to have options', () => {
        let executed = false;
        let receivedArgs : string[];
        processor.command('hello', cmd => 
            cmd
                .option({
                    id: 'place',
                    short: 'p',
                    valueHint: 'value',
                    description: 'Where to hello?'
                })
                .run(args => {
                    receivedArgs = args;
                    executed = true;
                    expect(cmd.option('place').present).to.be.true;
                    expect(cmd.option('place').value).to.equal('world');
                })
        );
        processor.process(['hello', '--place', 'world']);
        expect(executed).to.be.true;
        expect(receivedArgs).to.eql([]);
        expect(processor.arguments).to.eql([]);
    });
    it('allows commands to have subcommands', () => {
        let executed = 0;
        let receivedArgs : string[] = [];
        processor.command('hello', cmd => 
            cmd
                .command('world', cmd => 
                    cmd.run(args => {
                        expect(args).to.eql(['baz']);
                        executed += 2;
                    })
                )
                .run(args => {
                    // should not run
                    executed += 1;
                })
        );
        processor.process(['hello', 'world', 'baz']);
        expect(executed).to.equal(2);
        expect(processor.arguments).to.eql([]);
    });
    it('should not run command when subcommand is invoked', () => {
        let executed = false;
        processor.command('hello', cmd => 
            cmd
                .command('world', cmd => 
                    cmd.run(() => {})
                )
                .run(() => executed = true)
        );
        processor.process(['hello', 'world']);
        expect(executed, 'outer command was executed').to.be.false;
    });
});

describe('--help', it => {
    let terminalDriver = new StringTerminalDriver();
    let processor : CommandLineProcessor;
    let exitCode : number;

    before(() => {
        TerminalDriverSelector.default = terminalDriver;
        terminalDriver.buffer = '';
        processor = new CommandLineProcessor();
        processor.exit = (code : number) => exitCode = code;
        exitCode = undefined;
    });
    after(() => {
        TerminalDriverSelector.default = null
    });

    it('is always available', () => {
        processor.process(['--help']);

        expect(exitCode).to.eql(0);
        expect(terminalDriver.buffer).to.contain('usage:');
        expect(terminalDriver.buffer).to.contain('--help, -h');
        expect(terminalDriver.buffer).to.contain('Show help information');
        expect(terminalDriver.buffer).not.to.contain('Commands:');
    });
    it('will show a defined option', () => {
        processor.option({
            id: 'world',
            description: 'World'
        });

        processor.process(['--help']);

        expect(exitCode).to.eql(0);
        expect(terminalDriver.buffer).to.match(/--world.*World/);
        expect(terminalDriver.buffer).not.to.contain(', -w');
    });
    it('will show the short form of an option, if present', () => {
        processor.option({
            id: 'hello',
            short: 'H',
            description: 'Hello'
        });

        processor.process(['--help']);

        expect(exitCode).to.eql(0);
        expect(terminalDriver.buffer).to.match(/--hello, -H.*Hello/);
    });
    it('will show all defined options', () => {
        processor.option({
            id: 'hello',
            short: 'H',
            description: 'Hello'
        });
        processor.option({
            id: 'world',
            description: 'World'
        });

        processor.process(['--help']);

        expect(exitCode).to.eql(0);
        expect(terminalDriver.buffer).to.match(/--hello, -H.*Hello/);
        expect(terminalDriver.buffer).to.match(/--world.*World/);
        expect(terminalDriver.buffer).not.to.contain(', -w');
    });
    it('will show the value hint of an option', () => {
        processor.option({
            id: 'hello',
            short: 'H',
            description: 'Hello',
            valueHint: 'place'
        });

        processor.process(['--help']);

        expect(exitCode).to.eql(0);
        expect(terminalDriver.buffer).to.match(/--hello, -H.*<place>.*Hello/);
    });
    it('will show defined commands', () => {
        processor.command('hello', cmd => 
            cmd
                .info({ description: 'Hello' })
                .run(() => {})
        );
        
        processor.process(['--help']);

        expect(exitCode).to.eql(0);
        expect(terminalDriver.buffer).to.contain('Commands:');
        expect(terminalDriver.buffer).to.match(/hello.*Hello/);
    });
    it('will show help of a command', () => {
        processor.option({
            id: 'nothing',
            description: 'Nothing to see here'
        });
        processor.command('hello', cmd => 
            cmd
                .option({
                    id: 'something',
                    description: 'Something to see here'
                })
                .info({ description: 'Hello' })
                .run(() => {})
        );
        
        processor.process(['hello', '--help']);

        expect(exitCode).to.eql(0);
        expect(terminalDriver.buffer).not.to.contain('--nothing');
        expect(terminalDriver.buffer).to.contain('--something');
    })
})