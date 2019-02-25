
/**
 * A promise that lets you wait until someone actually requests the result of the promise to kick off 
 * the action being promised. This lets you return the promise before you start executing the async action.
 */
export class LazyPromise<T> extends Promise<T> {
    constructor(
        private fulfiller : () => Promise<T>
    ) {
        super((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

    }

    private _resolve : (result : T) => void;
    private _reject : (reason? : any) => void;

    fulfill() {
        if (!this.realPromise) {
            this.realPromise = this.fulfiller()
                .then(v => this._resolve(v))
                .catch(e => this._reject(e))
            ;
        }
    }

    private realPromise : Promise<void>;

    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
        this.fulfill();
        return super.then(onfulfilled, onrejected);
    }

    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult> {
        this.fulfill();
        return super.catch(onrejected);
    }
}
