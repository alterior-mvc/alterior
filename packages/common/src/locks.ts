import { AsyncZone } from "./zones";

/**
 * Provides a mechanism for ensuring that multiple function calls do not overlap, even if they are asynchronous.
 * NOTE: This does not include macrotasks (ie setTimeout/setInterval/etc). If you require that, see ZoneLock.
 */
export class Lock {
    constructor() {
    }

    private _ready?: Promise<void>;
    private static _namedLocks: Map<any, Lock>;

    static forToken<T extends Lock>(this: { new(): T }, token: any): T {

        let prop = Object.getOwnPropertyDescriptor(this, '_namedLocks');
        let map: Map<any, T>;

        if (!prop) {
            map = new Map<any, T>();

            Object.defineProperty(this, '_namedLocks', {
                enumerable: false,
                value: map
            });
        } else {
            map = prop.value;
        }

        let lock = map.get(token);

        if (!lock) {
            lock = new this();
            map.set(token, lock);
        }

        return lock;
    }

    protected async executeCallback<T>(cb: () => T | Promise<T>): Promise<T> {
        return await cb();
    }

    async run<T>(cb: () => T | Promise<T>) {
        let ready = this._ready;
        let value = undefined;
        let error = undefined;

        this._ready = new Promise(async resolve => {
            await ready;

            try {
                value = await this.executeCallback(cb);
            } catch (e) {
                error = e;
            }
            resolve();
        });

        await this._ready;

        if (error !== undefined)
            throw error;
           
        return value;
    }
}

/**
 * Provides a mechanism for ensuring that multiple function calls do not overlap, even if they are asynchronous
 * or they spin off macrotasks (ie setTimeout/setInterval/etc). Zone.js is used to accomplish this. For a lighter
 * lock that does not track macrotasks see Lock.
 */
export class ZoneLock extends Lock {
    constructor() {
        super();
    }

    protected async executeCallback<T>(cb: () => T | Promise<T>) {
        return await AsyncZone.run(cb);
    }
}