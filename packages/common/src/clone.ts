/**
 * Perform a shallow clone of the object, producing one that has the 
 * same constructor chain and prototype as the passed object.
 * @param obj 
 */
export function shallowClone(obj : Object) {
	if (typeof obj !== 'object')
		return obj;
	
	let clone = Object.create(obj.constructor.prototype);
	Object.assign(clone, obj);
	return clone;
}

/**
 * Perform a standard clone using serialization (see cloneBySerialization)
 * @param obj 
 */
export function clone<T = any>(obj : T): T {
	return cloneBySerialization(obj);
}

/**
 * Deeply clone the given value. If the value is an object, all subobjects
 * are deeply cloned as well.
 * 
 * @param o 
 */
export function deepClone<T>(o: T): T {
    if (typeof structuredClone === 'function')
        return structuredClone(o);
	return deepCloneWithMemoization(o, new WeakMap());
}

function deepCloneWithMemoization<T>(o: T, memo : WeakMap<any, any>): T;
function deepCloneWithMemoization<T>(o: T | null, memo : WeakMap<any, any>): T | null;
function deepCloneWithMemoization<T>(o: T | undefined, memo : WeakMap<any, any>): T | undefined;
function deepCloneWithMemoization<T>(o: T | null | undefined, memo : WeakMap<any, any>): T | null | undefined;
function deepCloneWithMemoization<T>(o: T | null | undefined, memo : WeakMap<any, any>): T | null | undefined {
	if (o === null || o === undefined || typeof o !== 'object')
		return o;

	if (!Array.isArray(o) && typeof o !== 'object')
		return o;

	if (memo.has(o))
		return memo.get(o);
	
	let output, v, key;
	output = Array.isArray(o) ? [] : {};
	
	memo.set(o, output);

	for (key in o) {
		v = (o as any)[key];
		(output as any)[key] = (typeof v === 'object') ? deepCloneWithMemoization(v, memo) : v;
	}

	return output as T;
}

/**
 * Clone the value by serializing it to JSON and back.
 * @param obj 
 */
export function cloneBySerialization<T>(obj: T): T;
export function cloneBySerialization<T>(obj: T | null): T | null;
export function cloneBySerialization<T>(obj: T | undefined): T | undefined;
export function cloneBySerialization<T>(obj: T | null | undefined): T | null | undefined;
export function cloneBySerialization<T>(obj: T | null | undefined): T | null | undefined {
	if (obj === undefined || obj === null || typeof obj !== 'object')
		return obj;
	
	return JSON.parse(JSON.stringify(obj));
}