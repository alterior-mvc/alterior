export type Method = (...args: any[]) => any;
export type ConcreteConstructor<T = object> = new (...args: any[]) => T;
export type AbstractConstructor<T = object> = abstract new (...args: any[]) => T;
export type Constructor<T = object> = ConcreteConstructor<T> | AbstractConstructor<T>;

export function allowConstruction<T extends (...args: any[]) => U, U>(func: T) {
    return <T & ConcreteConstructor<U>>func;
}