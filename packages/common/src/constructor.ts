
/**
 * Represents a constructor. Useful for type gymnastics.
 */

export type ConcreteConstructor<T = object> = new (...args: any[]) => T;
export type AbstractConstructor<T = object> = abstract new (...args: any[]) => T;
export type Constructor<T = object> = ConcreteConstructor<T> | AbstractConstructor<T>;