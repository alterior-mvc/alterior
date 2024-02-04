import { ReadStream, WriteStream } from 'tty';
import readline from 'readline';
import { styled, StyledString } from './style';

export class TerminalUI {
    constructor(input = process.stdin, output = process.stdout) {
        this.input = input;
        this.output = output;
    }

    input: ReadStream;
    output: WriteStream;

    private rl: readline.Interface | null = null;
    private _prompt: string = '';
    get prompt() {
        return this._prompt;
    }

    set prompt(value) {
        this._prompt = value;
        if (this.rl) {
            this.rl.setPrompt(value);
            (this.rl as any)._refreshLine();
        }
    }

    runCommand?: (line: string) => Promise<void>;
    beforeShowingPrompt?: () => Promise<void>;
    runningCommand = false;

    async start() {
        //await this.runCommand('sleep');
        this.startPrompt();
    }

    history: string[] = [];

    private async startPrompt() {
        readline.emitKeypressEvents(this.input);
        this.rl = readline.createInterface({ 
            input: this.input, 
            output: this.output,
            history: this.history
        });
        this.rl.addListener('SIGINT', () => {
            this.log();
        });
        this.rl.setPrompt(this._prompt);
        this.rl.addListener('history', async lines => this.history = lines);
        this.rl.addListener('line', async line => {
            this.rl?.close();
            this.rl = null;
            this.runningCommand = true;

            this.output.cork();
            this.output.moveCursor(0, -1);
            this.deletePrompt();
            this.output.uncork();
            try {
                await this.runCommand?.(line);
            } finally {
                this.runningCommand = false;
                this.output.cork();
                this.startPrompt();
                this.output.uncork();
            }
        });

        await this.beforeShowingPrompt?.();

        this.allocatePromptSpace();
        this.rl.prompt();
    }

    private allocatePromptSpace() {
        let lines = this._prompt.split("\n").length + 1;
        this.output.write(Array(lines + 1).join("\n"));
        this.output.moveCursor(0, -lines);
    }

    private deletePrompt() {
        for (let i = 0, max = this.prompt.split("\n").length; i < max; ++i) {
            this.output.clearLine(0);
            this.output.cursorTo(0);
            if (i + 1 < max)
                this.output.moveCursor(0, -1);
        }
    }

    async log(...contents: (string | number | StyledString)[]) {
        let message = styled(...<any[]>contents);
        let actualCursorPos = this.rl?.getCursorPos() ?? { rows: 0, cols: 0 };
        this.output.cork();
        if (this.rl)
            this.deletePrompt();
        this.output.write(message + `\n`);
        if (this.rl) {
            this.allocatePromptSpace();
            this.output.write(this.prompt + this.rl.line);
            this.output.cursorTo(actualCursorPos.cols);
        }

        this.output.uncork();
    }
}