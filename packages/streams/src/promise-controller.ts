import { React, SetPromiseIsHandledToTrue } from "./util";

export class PromiseController<T = void> {
    constructor() {
        this.#promise = new Promise<T>((resolve, reject) => (this.#resolve = resolve, this.#reject = reject));
    }

    #promise : Promise<T>;
    #resolve : (t : T | PromiseLike<T>) => void;
    #reject : (e) => void;
    #error;
    #fulfilled = false;
    #value : T;

    get fulfilled() { return this.#fulfilled; }
    get promise() { return this.#promise; }
    get error() { return this.#error; }
    get value() { return this.#value; }
    get state() : 'pending' | 'fulfilled' {
        if (this.#fulfilled)
            return 'fulfilled';
        return 'pending';
    }

    resolve(t : T | PromiseLike<T>) {
        this.#fulfilled = true;
        React(t, t => this.#value = t);
        this.#resolve(t);
        return this;
    }

    reject(e) {
        this.#error = e;
        this.#fulfilled = true;
        this.#reject(e);
        return this;
    }

    markHandled() {
        SetPromiseIsHandledToTrue(this.#promise);
        return this;
    }

    static resolve<T = any>(v? : T) {
        let ctrl = new PromiseController<T>();
        ctrl.resolve(v);
        return ctrl;
    }

    static reject(error) {
        let ctrl = new PromiseController<any>();
        ctrl.reject(error);
        return ctrl;
    }
}
