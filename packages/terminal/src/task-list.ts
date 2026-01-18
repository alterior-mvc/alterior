import { count, zeroPad } from '@alterior/functions';
import { startStyle, style, styled } from './style';

const CLI_TASK_ERROR_ICON = '𐄂';
const CLI_TASK_FINISHED_ICON = '✓';
const INDENT = '    ';

export interface CLITaskInit {
    omitInNonInteractive?: boolean;
    parentTask?: CLITask;
}

export class CLITaskList {
    constructor(readonly interactive = true, readonly silent = false) {
        this.globalTask.onUpdated = task => {
            if (!this.interactive) {
                if (task.children.length === 0)
                    task.renderNonInteractive(this);
                return;
            }
            // When the last task completes, we need to re-render inline to be sure we render the right state.
            // But we only want to do this once, and only when needed, otherwise its a waste.
            if (this.globalTask.children.every(t => t.status !== 'running'))
                this.render();
        };
        this.globalTask.onLog = (task: CLITask, message: string) => {
            if (this.interactive)
                return;

            task.renderNonInteractive(this);
            for (let line of message.split(/\r?\n/))
                task.renderLogLine(this, line);
        }
    }

    private timer;
    private renderedLineCount = 0;
    readonly spinner = new CLITaskStatusWidget();
    private globalTask = new CLITask('Global Task');

    private started = false;
    startCursor: { x: number, y: number } = { x: 0, y: 0 };

    private start() {
        if (!this.interactive)
            return;

        if (this.started)
            return;

        this.started = true;
        this.timer = setInterval(() => this.render(), 1000 / 30);
        this.spinner.start();
    }

    stop() {
        if (!this.interactive)
            return;

        this.started = false;
        clearInterval(this.timer);
        this.timer = undefined;
        this.renderedLineCount = 0;
        this.spinner.stop();
    }

    get remainingLines() {
        // The -2 here is:
        // -  (x) Its desirable to keep the prompt line visible at the top of the screen if possible (-1)
        // - We will have one empty line visible at the end of the output to avoid flickering the
        //   cursor (-1)
        return Math.max(0, process.stdout.rows - this.renderedLineCount - 1);
    }

    startTask(title: string, init?: CLITaskInit) {
        let task = new CLITask(title, init);
        this.addTask(task);
        return task;
    }

    addTask(task: CLITask) {
        if (!this.started) {
            this.start();
        }

        this.globalTask.addTask(task);
    }

    get allTasksFinished() {
        return this.globalTask.children.every(x => x.status !== 'running');
    }

    idle = false;
    private idleTimeout: any;
    beforeCpu: NodeJS.CpuUsage;
    cpu: NodeJS.CpuUsage;
    ram: NodeJS.MemoryUsage;

    lastTimestamp: bigint = BigInt(0);
    secondTicks = 1_000_000;
    startedAt = Date.now();

    private render() {
        let newSecond = process.hrtime.bigint();
        if (this.lastTimestamp + BigInt(1_000_000_000) < newSecond) {
            this.secondTicks = Number((newSecond - this.lastTimestamp) / BigInt(1_000));
            this.lastTimestamp = newSecond;
            this.cpu = process.cpuUsage(this.beforeCpu);
            this.beforeCpu = process.cpuUsage();
            this.ram = process.memoryUsage();
        }

        this.startFrame();

        // other cool u characters include: 𝖚
        // see more: https://unicodeplus.com/U+0075

        let elapsedTime = formatDuration(Date.now() - this.startedAt)

        this.drawHeader();

        this.globalTask.renderChildren(this, new LineTracker(this.remainingLines));
        this.endFrame();
    }

    drawHeader() {
        
    }

    private startFrame() {
        process.stdout.cork();
        process.stdout.moveCursor(0, -this.renderedLineCount);
        this.renderedLineCount = 0;
    }

    private endFrame() {
        process.stdout.clearScreenDown();
        process.stdout.uncork();

        // Update idle
        if (this.idle !== this.allTasksFinished) {
            this.idle = this.allTasksFinished;
            if (this.idle) {
                this.idleTimeout = setTimeout(() => {
                    if (this.idle) {
                        this.stop();
                    }
                }, 1_000);
            } else {
                this.idle = false;
                clearTimeout(this.idleTimeout);
            }
        }
    }

    drawLine(input: string = ''): void {
        if (this.silent)
            return;

        if (!this.interactive) {
            console.log(input);
            return;
        }

        let lines = input.split(/\r?\n/);
        let count = 0;

        for (let line of lines) {
            process.stdout.clearLine(0);
            process.stdout.write(`${this.truncateLineIfNeeded(line)}\n`);
            process.stdout.clearLine(1);

            this.renderedLineCount += 1;
            count += 1;
        }
    }

    private truncateLineIfNeeded(line: string) {
        let indicatorPattern = /\u001b\[[^m]*m/g;
        let visibleLength = line.replace(indicatorPattern, '').length;
        if (visibleLength < process.stdout.columns)
            return line;

        let newLine = '';
        let newVisible = 0;

        for (let i = 0, max = line.length; i < max && newVisible < process.stdout.columns - 3; ++i) {
            let match = /^\u001b\[[^m]*m/.exec(line.slice(i));
            if (match) {
                newLine += `${match[0]}`;
                i += match[0].length - 1;
            } else {
                newLine += line.at(i);
                newVisible += 1;
            }
        }

        newLine += styled(style.$dim('...'));

        // We may have cut off style codes by eliding this line. To prevent weirdness, we must
        // reset the terminal back to default
        newLine += startStyle('reset');
        return newLine;
    }
}

class LineTracker {
    constructor(private _maxLines: number) {
    }

    static unbounded = new LineTracker(undefined);
    private _consumed = 0;

    get maxLines() {
        if (this._maxLines === undefined)
            return Number.MAX_SAFE_INTEGER;
        return this._maxLines;
    }

    get consumed() {
        if (this._maxLines === undefined)
            return 0;
        return this._consumed;
    }

    consume(count: number = 1) {
        if (this._maxLines !== undefined)
            this._maxLines -= count;
        this._consumed += count;
    }
}

export type CLITaskCharm = () => string;
export type CLITaskStatus = 'running' | 'error' | 'finished';
export class CLITask {
    constructor(title: string, init: CLITaskInit = {}) {
        this.title = title;
        if (init.omitInNonInteractive)
            this.omitInNonInteractive = true;
    }
    parent?: CLITask;
    children: CLITask[] = [];
    title: string;
    status: CLITaskStatus = 'running';
    finishedAt: number;
    startedAt = Date.now();

    charms: CLITaskCharm[] = [];
    staleAfter = 0;
    staleWithErrorsAndLogAfter = 10_000;
    omitInNonInteractive = false;

    private logMessages: string[] = [];

    // Computed Properties

    get depth() {
        return (this.parent?.depth ?? -1) + 1;
    }

    get indent() {
        if (this.depth === 0)
            return ``;
        return Array.from(Array(this.depth - 1)).map(() => INDENT).join('');
    }

    get isFinishedAndStale(): boolean {
        let staleTime = this.containsLogsOrError ? this.staleWithErrorsAndLogAfter : this.staleAfter;
        let freshness = Math.min(staleTime);
        return this.status === 'finished' && this.finishedAt + freshness < Date.now();
    }

    get containsLogsOrError(): boolean {
        return this.logMessages.length > 0 || this.status === 'error' || this.children.some(x => x.containsLogsOrError);
    }

    get isDeleted() {
        return this.parent ? !this.parent?.children.includes(this) : false;
    }

    get parents() {
        let parents: CLITask[] = [];
        let parent = this.parent;
        while (parent?.parent) {
            parents.unshift(parent);
            parent = parent.parent;
        }
        return parents;
    }

    get chain() {
        return [...this.parents, this];
    }

    // Events

    onUpdated: (task: CLITask) => void;
    onDeleted: (task: CLITask) => void;
    onLog: (task: CLITask, message: string) => void;

    // Lifecycle API

    log(message: string) {
        this.logMessages.push(...message.split(/\r?\n/));
        this.onLog?.(this, message);
    }

    error(message?: string) {
        this.status = 'error';
        this.log(`[Error] ${message || 'The task failed.'}`);
    }

    finish(notify = true) {
        this.status = 'finished';
        this.finishedAt = Date.now();

        for (let child of this.children)
            child.finish(false);

        if (notify)
            this.onUpdated?.(this);
    }

    delete() {
        this.onDeleted?.(this);
    }

    // Subtasks

    subtask(title: string, init: CLITaskInit = {}): CLITask {
        let child = new CLITask(title, init);
        this.addTask(child);
        return child;
    }

    addTask(child: CLITask) {
        this.children.push(child);
        child.parent = this;
        child.onUpdated = child => this.onUpdated?.(child);
        child.onLog = (task, message) => this.onLog?.(task, message);
        child.onDeleted = child => {
            let index = this.children.indexOf(child);
            if (index >= 0)
                this.children.splice(index, 1);
            this.onUpdated?.(child);
        };

        return child;
    }

    // Rendering

    render(renderer: CLITaskList, lineTracker: LineTracker, parentFinished = false) {
        if (parentFinished && !this.containsLogsOrError)
            return 0;

        this.renderSelf(renderer, lineTracker);
        this.renderChildren(renderer, lineTracker, parentFinished || this.isFinishedAndStale);
        this.renderLogs(renderer, lineTracker);
    }

    renderNonInteractive(renderer: CLITaskList) {
        if (this.omitInNonInteractive)
            return;
        renderer.drawLine(this.chain.filter(x => !x.omitInNonInteractive).map(p => `${p.statusStyle(p.title)}`).join(' » '));
    }

    renderSelfAndParents(renderer: CLITaskList) {
        for (let parent of this.parents)
            parent.renderSelf(renderer, LineTracker.unbounded);
        this.renderSelf(renderer, LineTracker.unbounded);
    }

    renderSelf(renderer: CLITaskList, lineTracker: LineTracker) {
        renderer.drawLine(
            `${this.indent ?? ''}`
            + `${this.statusStyle(`${this.iconForStatus(renderer)} ${this.title}`, this.status)}`
            + `${this.summarizeCounts(renderer)}`
            //+ ` DEBUG: ${maxLines}`
        );
        lineTracker.consume();
    }

    renderLogs(renderer: CLITaskList, lineTracker: LineTracker) {
        let displayedLogs = this.logMessages.slice();
        while (displayedLogs.length > lineTracker.maxLines)
            displayedLogs.shift();
        for (let line of displayedLogs) {
            this.renderLogLine(renderer, line);
            lineTracker.consume();
        }
    }

    renderLogLine(renderer: CLITaskList, line: string) {
        renderer.drawLine(`${this.indent ?? ''}  ${styled(style.$dim(line))}`);
    }

    renderChildren(renderer: CLITaskList, lineTracker: LineTracker, parentFinished = false) {
        if (lineTracker.maxLines <= 0)
            return 0;

        let statusOrder = {
            'error': 0,
            'finished': 1,
            'running': 2
        };
        this.children.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

        let maxDisplayedTasks = lineTracker.maxLines;
        let displayedTasks = this.children.slice();

        if (parentFinished) {
            displayedTasks = displayedTasks.filter(x => x.containsLogsOrError);
        } else {
            displayedTasks = displayedTasks.filter(x => !x.isFinishedAndStale);
        }

        // If we're tight on space, elide freshly finished tasks, too.
        while (displayedTasks.length > maxDisplayedTasks) {
            let taskIndex = displayedTasks.findIndex(x => x.status === 'finished');
            if (taskIndex < 0)
                break;

            displayedTasks.splice(taskIndex, 1);
        }

        // Elide errors (better to see ongoing progress) ////////////////

        while (displayedTasks.length > maxDisplayedTasks) {
            let taskIndex = displayedTasks.findIndex(x => x.status === 'error');
            if (taskIndex < 0)
                break;

            displayedTasks.splice(taskIndex, 1);
        }

        // Elide all remaining from end of sorted list until we fit within the maxDisplayedTasks

        if (displayedTasks.length > maxDisplayedTasks)
            displayedTasks.splice(maxDisplayedTasks, displayedTasks.length);

        let extraLinesForChildren = lineTracker.maxLines - displayedTasks.length;
        for (let task of displayedTasks) {
            let childLineTracker = new LineTracker(1 + extraLinesForChildren);
            task.render(renderer, childLineTracker, parentFinished);
            lineTracker.consume(childLineTracker.consumed);
            extraLinesForChildren -= (childLineTracker.consumed - 1);
            extraLinesForChildren = Math.max(0, extraLinesForChildren);
        }
    }

    // Helpers

    private summarizeCounts(r: CLITaskList) {
        let counts = [
            this.logMessages.length > 0 ? `${styled(style.$yellow(`• ${this.logMessages.length}`))}` : undefined,
            this.summarizeCount(r, count(this.children, x => x.status === 'finished'), 'finished'),
            this.summarizeCount(r, count(this.children, x => x.status === 'error'), 'error'),
            this.summarizeCount(r, count(this.children, x => x.status === 'running'), 'running'),
        ].filter(x => x);

        if (counts.length === 0)
            return '';

        return `  ${styled(style.$dim(counts.join('   ')))}`;
    }

    private summarizeCount(r: CLITaskList, count: number, status: CLITaskStatus) {
        if (count <= 0)
            return undefined;
        return this.statusStyle(`${this.iconForStatus(r, status)} ${count}`, status);
    }

    private statusStyle(line: string, status: CLITaskStatus = this.status) {
        if (status === 'running') {
            line = styled(style.$bold(style.$blue(line)));
        } else if (status === 'finished') {
            line = styled(style.$green(line));
        } else if (status === 'error') {
            line = styled(style.$red(line));
        }

        return line;
    }

    private iconForStatus(renderer: CLITaskList, status: CLITaskStatus = this.status) {
        if (this.status === 'error')
            return CLI_TASK_ERROR_ICON;
        else if (this.status === 'finished')
            return CLI_TASK_FINISHED_ICON;

        return renderer.spinner.render();
    }
}

export class CLITaskStatusWidget {
    constructor(private task?: CLITask) {
        this.start();
    }

    protected readonly spinner: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    private id?: NodeJS.Timeout

    private spinnerPosition = 0

    public spin(): void {
        this.spinnerPosition = ++this.spinnerPosition % this.spinner.length
        if (this.task && this.task.status !== 'running') {
            clearInterval(this.id);
        }
    }

    public render(): string {
        if (this.task?.status === 'error')
            return CLI_TASK_ERROR_ICON;
        else if (this.task?.status === 'finished')
            return CLI_TASK_FINISHED_ICON;

        return this.spinner[this.spinnerPosition]
    }

    public isRunning(): boolean {
        return !!this.id
    }

    public start(cb?: () => void, interval = 100): void {
        clearInterval(this.id);
        this.id = setInterval(() => {
            this.spin()

            if (cb) {
                cb()
            }
        }, interval)
    }

    public stop(): void {
        clearInterval(this.id)
    }
}

function formatDuration(duration: number) {

    const msPerSec = 1000;
    const msPerMinute = (1000 * 60);
    const msPerHour = (1000 * 60 * 60);

    let hours = duration / msPerHour | 0;
    let minutes = (duration - (hours * msPerHour)) / msPerMinute | 0;
    let seconds = (duration - (hours * msPerHour + minutes * msPerMinute)) / msPerSec | 0;
    let ms = duration % 1000;

    return `${zeroPad(hours)}:${zeroPad(minutes)}:${zeroPad(seconds)}:${zeroPad(ms, 3)}`;
}