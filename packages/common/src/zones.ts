/**
 * Copyright Google Inc. All Rights Reserved.
 * Copyright William Lahti
 * 
 * Derived from Angular's NgZone
 * https://github.com/angular/angular/blob/6.0.0/packages/core/src/zone/ng_zone.ts
 * 
 */

import { Observable, Subject } from 'rxjs';

export class AsyncZone {
    public constructor(name : string, properties : any = {}) {
        let self = this;

        this._outside = Zone.current;
        this._zone = Zone.current.fork({
            name,
            properties,

            onInvoke(delegate, current, target, callback, applyThis, applyArgs, source) {
                return self.innerInvoke(() => delegate.invoke(target, callback, applyThis, applyArgs, source));
            },
            
            onInvokeTask(delegate: ZoneDelegate, current: Zone, target: Zone, task: Task, applyThis: any, applyArgs: any) {
                return self.innerInvoke(() => delegate.invokeTask(target, task, applyThis, applyArgs));
            },

            onHasTask(delegate, current, target, hasTaskState) {
                delegate.hasTask(target, hasTaskState);

                if (hasTaskState.change == 'microTask') {
                    if (hasTaskState.microTask) {
                        if (!self._zonesWithPendingMicrotasks.includes(target))
                            self._zonesWithPendingMicrotasks.push(target);
                    } else {
                        self._zonesWithPendingMicrotasks = self._zonesWithPendingMicrotasks.filter(x => x !== target);
                    }

                    self._hasPendingMicrotasks = hasTaskState.microTask;
                } else if (hasTaskState.change == 'macroTask') {
                    self._hasPendingMacrotasks = hasTaskState.macroTask;
                    
                    if (hasTaskState.macroTask) {
                        if (!self._zonesWithPendingMacrotasks.includes(target))
                            self._zonesWithPendingMacrotasks.push(target);
                    } else {
                        self._zonesWithPendingMacrotasks = self._zonesWithPendingMacrotasks.filter(x => x !== target);
                    }
                }

                self.checkStable();
            },
            
            onHandleError(delegate, current, target, error) {
                self.runOutside(() => self._onError.next(error));
                return false;
            }
        });
    }

    private _zonesWithPendingMicrotasks : Zone[] = [];
    private _zonesWithPendingMacrotasks : Zone[] = [];

    private _outside : Zone;
    private _nesting : number = 0;
    private _hasPendingMicrotasks : boolean;
    private _hasPendingMacrotasks : boolean;
    private _zone : Zone;
    private _onError : Subject<Error> = new Subject<Error>();
    private _isStable : boolean;
    private _onMicrotaskEmpty : Subject<void> = new Subject<void>();
    private _onStable : Subject<void> = new Subject<void>();

    public static run<T>(cb : () => (Promise<T> | T)): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let zone = new AsyncZone('AsyncZone');
            let value;

            zone.onStable.subscribe(() => resolve(value));
            zone.onError.subscribe(e => reject(e));
            zone.invoke(async () => value = await cb());
        });
    }

    /**
     * Get the underlying Zone object.
     * @returns Zone
     * @todo Typed as `any` to avoid issue where this reference to Zone
     *       is undefined because we cannot directly export Zone's types without
     *       directly referencing Zone. PRs welcome.
     */
    public get zone(): any {
        return this._zone;
    }

    public get onMicrotaskEmpty(): Observable<void> {
        return this._onMicrotaskEmpty;
    }

    public get onStable(): Observable<void> {
        return this._onStable;
    }

    public get onError(): Observable<Error> {
        return this._onError;
    }

    public checkStable() {
        if (this._nesting > 0 || this._hasPendingMacrotasks || this._hasPendingMicrotasks || this._isStable)
            return;

        if (this._zonesWithPendingMicrotasks.length > 0 || this._zonesWithPendingMacrotasks.length > 0)
            return;
        
        try {
            this._nesting++;
            this._onMicrotaskEmpty.next(null);
        } finally {
            this._nesting--;

            if (!this._hasPendingMicrotasks) {
                try {
                    this.runOutside(() => this._onStable.next(null));
                } finally {
                    this._isStable = true;
                }
            }
        }
    }

    public runOutside(runnable) {
        this._outside.run(runnable);
    }

    public invoke(callback : () => void) {
        this._zone.runGuarded(() => this.innerInvoke(callback));
    }

    private innerInvoke(callback : () => void) {
        this.onEnter();
        try {
            return callback();
        } finally {
            this.onLeave();
        }
    }

    public onEnter() {
        this._nesting += 1;
    }

    public onLeave() {
        this._nesting -= 1;
    }
}