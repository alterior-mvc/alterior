import { AsyncZone } from "./zones";

export class Lock {
    constructor() {
    }

    private _ready : Promise<void>;
    private static _namedLocks : Map<any, Lock>;

    static forToken<T extends Lock>(this : { new() : T }, token : any): T {

        let prop = Object.getOwnPropertyDescriptor(this, '_namedLocks');
        let map : Map<any, T>;

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

    protected async executeCallback(cb) {
        return await cb();
    }

    async run(cb : Function) {
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

export class ZoneLock extends Lock {
    constructor() {
        super();
    }

    protected async executeCallback(cb) {
        return await AsyncZone.run(cb);
    }
}