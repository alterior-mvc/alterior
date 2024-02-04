import { WebEvent } from './metadata';
import { Constructor } from '@alterior/runtime';
import { Injectable } from '@alterior/di';

@Injectable()
export class Session {
    static current<T>(this : Constructor<T>): T {
        return new Proxy(new (<any>this)(), {
            get: (target, key : string, receiver) => target.get(key)
        });
    }

    get<T>(id : string, defaultValue? : T): T {
        return WebEvent.current.request.session?.[id] ?? defaultValue;
    }

    set<T>(id : string, value : T) {
        WebEvent.current.request.session![id] = value;
    }
}