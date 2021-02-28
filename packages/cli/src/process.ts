import * as childProcess from 'child_process';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import * as os from 'os';
import { fileExists, pathCombine } from './utils';

export interface ProcessExitedEvent {
    code : number;
    signal : NodeJS.Signals;
}

export interface ProcessResult {
    code : number;
    signal : NodeJS.Signals;
}

export interface ProcessStartInfo {
    command : string;
    args : string[];
    shell : string | boolean;
    stdio: childProcess.StdioOptions;
}

export class Process {
    constructor(readonly handle : childProcess.ChildProcess) {
        handle.on('exit', (code, signal) => {
            this._exited.next({ code, signal: <NodeJS.Signals>signal });
            this._exited.complete();
        });

    }

    private _exited = new ReplaySubject<ProcessExitedEvent>();

    get exited() : Observable<ProcessExitedEvent> {
        return this._exited;
    }

    static whichCache : Record<string,string> = {};

    static async which(command : string): Promise<string> {

        if (this.whichCache[command])
            return this.whichCache[command];
        
        let colon = ':';

        if (os.platform() === 'win32')
            colon = ';';
           
        let dirs = process.env.PATH.split(colon);

        let options = Promise.all(
            dirs.map(async dir => {
                if (os.platform() === 'win32') {
                    let extensions = ['cmd', 'bat', 'exe'];
                    for (let extn of extensions) {
                        let commandPath = pathCombine(dir, `${command}.${extn}`);
                        if (await fileExists(commandPath))
                            return commandPath;
                    }
                } else {
                    let commandPath = pathCombine(dir, command);
                    if (await fileExists(commandPath))
                        return commandPath;
                }
            })
        );

        let path = (await options).filter(x => x)[0];

        this.whichCache[command] = path;
        return path;
    }

    static async start(psi : ProcessStartInfo): Promise<Process> {
        let path = await this.which(psi.command);
        if (!path)
            throw new Error(`Cannot find command '${psi.command}'`);

        return new Process(
            childProcess.spawn(
                path, 
                psi.args,
                {
                    stdio: psi.stdio,
                    shell: psi.shell
                }
            )
        );
    }

    static async run(psi : ProcessStartInfo) : Promise<ProcessResult> {
        let proc = await this.start(psi);
        let result = await proc.exited.toPromise();
        return result;
    }
}