
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
	return deepCloneWithMemoization(o, new WeakMap());
}

function deepCloneWithMemoization<T>(o: null, memo : WeakMap<any, any>): null;
function deepCloneWithMemoization<T>(o: T, memo : WeakMap<any, any>): T
function deepCloneWithMemoization<T>(o: T[], memo : WeakMap<any, any>): T[];
function deepCloneWithMemoization<T>(o: T | T[] | null, memo : WeakMap<any, any>): T | T[] | null {
	if (o === null)
		return null;
	if (!Array.isArray(o) && typeof o !== 'object')
		return o;

	if (memo.has(o))
		return memo.get(o);
	
	if (Array.isArray(o)) {
		memo.set(o, o.map(v => deepCloneWithMemoization(v, memo)));
		return memo.get(o);
	}

	let output, v, key;
	output = {} as T;
	
	memo.set(o, output);

	for (let key of Object.keys(o) as (keyof T)[]) {
		v = o[key];
		(output as any)[key] = (typeof v === 'object') ? deepCloneWithMemoization(v, memo) : v;
	}

	return output;
}
/**
 * Clone the value by serializing it to JSON and back.
 * @param obj 
 */
export function cloneBySerialization<T>(obj: T): T {
	if (obj === undefined || obj === null || typeof obj !== 'object')
		return obj;
	
	return JSON.parse(JSON.stringify(obj));
}