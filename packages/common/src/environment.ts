/**
 * Access the environment variables of the current process.
 */
export class Environment {
    constructor() {
        this.env = typeof process !== 'undefined' ? process.env : {};
    }

    private defaults : any;
    private env : any;

    get raw(): any {
        return this.env;
    }

    setup<T>(defaults : Partial<T>) {
        this.defaults = defaults;
    }

    get<T = any>() : T {
        return Object.assign(
            {},
            this.defaults,
            (typeof process !== 'undefined' ? process.env as any : null) || {}
        );
    }
}