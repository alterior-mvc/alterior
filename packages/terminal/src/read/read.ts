import readline from 'readline';
import Mute from 'mute-stream';
import { ReadStream, WriteStream } from 'tty';

export interface ReadOptions {
  /**
   * The default value if the user enters nothing.
   */
  default?: any;

  /**
   * Readable stream to get input data from. (default `process.stdin`)
   */
  input?: ReadStream;

  /**
   * Writable stream to write prompts to. (default: `process.stdout`)
   */
  output?: WriteStream;

  /**
   * What to write to stdout before reading input.
   */
  prompt?: string;

  /**
   * Don't echo the output as the user types it.
   */
  silent?: boolean;

  /**
   * Number of ms to wait for user input before giving up.
   */
  timeout?: number;

  /**
   * Allow the user to edit the default value.
   */
  edit?: boolean;

  /**
   * Treat the output as a TTY, whether it is or not.
   */
  terminal?: boolean;

  /**
   * Replace silenced characters with the supplied character value.
   */
  replace?: string;
}

export default async function read (options?: ReadOptions): Promise<string> {
  let opts = { prompt: '', ...options };
  opts.input ??= process.stdin;
  opts.output ??= process.stdout;

  if (typeof opts.default !== 'undefined' && typeof opts.default !== 'string' && typeof opts.default !== 'number') {
    throw new Error('default value must be string or number')
  }

  let editDef = false;
  opts.prompt = opts.prompt.trim() + ' '
  opts.terminal = !!(opts.terminal || opts.output.isTTY)

  if (opts.default) {
    if (opts.silent) {
      opts.prompt += '(<default hidden>) '
    } else if (opts.edit) {
      editDef = true
    } else {
      opts.prompt += '(' + opts.default + ') '
    }
  }

  const input = opts.input;
  const output = new Mute({ replace: opts.replace, prompt: opts.prompt })
  output.pipe(opts.output, { end: false });

  return new Promise<string>((resolve, reject) => {
    const rl = readline.createInterface({ input, output, terminal: opts.terminal })
    const timer = opts.timeout && setTimeout(() => onError(new Error('timed out')), opts.timeout)

    output.unmute();
    rl.setPrompt(opts.prompt);
    rl.prompt();

    if (opts.silent) {
      output.mute();
    } else if (editDef) {
      (rl as any).line = opts.default;
      (rl as any).cursor = opts.default!.length;
      (rl as any)._refreshLine();
    }

    const done = () => {
      rl.close()
      clearTimeout(timer)
      output.mute()
      output.end()
    }

    const onError = (er) => {
      done()
      reject(er)
    }

    rl.on('error', onError)
    rl.on('line', (line) => {
      if (opts.silent && opts.terminal) {
        output.unmute()
        output.write('\r\n')
      }
      done()
      // truncate the \n at the end.
      const res = line.replace(/\r?\n$/, '') || opts.default || ''
      return resolve(res)
    })

    rl.on('SIGINT', () => {
      rl.close()
      onError(new Error('canceled'))
    })
  })
}
