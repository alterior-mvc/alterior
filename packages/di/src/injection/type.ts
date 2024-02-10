/**
 * Represents a constructable class.
 */
export type Type<T = object> = ConcreteType<T> | AbstractType<T>;

export type ConcreteType<T = object> = new () => T;
export type AbstractType<T = object> = abstract new (...args: any[]) => T;

export type SetterFn = (obj: any, value: any) => void;
export type GetterFn = (obj: any) => any;
export type MethodFn = (obj: any, args: any[]) => any;

export function isType(v: any): v is Type<any> {
  return typeof v === 'function';
}
