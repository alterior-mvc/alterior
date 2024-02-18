import { InjectionToken } from "./injection-token";
import { ConcreteType, Type } from "./type";

export interface NormalizedProvider<T = any>  {
    provide: Type<T> | InjectionToken<T>;
    useValue?: T;
    useClass?: ConcreteType<T>;
    useExisting?: Type<T> | InjectionToken<T>;
    useFactory?: () => T;
    multi?: boolean;
    unique?: boolean;
}
