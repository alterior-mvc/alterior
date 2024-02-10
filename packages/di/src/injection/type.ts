/**
 * @whatItDoes Represents a type that a Component or other object is instances of.
 *
 * @description
 *
 * An example of a `Type` is `MyCustomComponent` class, which in JavaScript is be represented by
 * the `MyCustomComponent` constructor function.
 *
 * @stable
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
