import { WebEvent } from './metadata';
import { Constructor } from '@alterior/runtime';
import { Injectable } from '@alterior/di';

@Injectable()
export class Session {
    static current<T extends Session>(this : Constructor<T>): T {
        return new Proxy(new (this as Constructor<T>)(), {
            get: (target, key : string, receiver) => target.get(key),
            set: (target, key: string, value: any) => (target.set(key, value), true)
        });
    }

    exists() {
        const request = WebEvent.request;
        if (!('session' in request))
            return false;
    }

    get<T>(id : string, defaultValue? : T): T {
        const request = WebEvent.request;
        if (!('session' in request))
            throw new Error(`Session is not available`);
        return (request.session as Record<string, any>)[id] ?? defaultValue;
    }

    set<T>(id : string, value : T) {
        const request = WebEvent.request;
        if (!('session' in request))
            throw new Error(`Session is not available`);

        (request.session as Record<string, any>)[id] = value;
    }
}