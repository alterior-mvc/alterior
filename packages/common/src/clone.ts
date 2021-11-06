
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
export function deepClone(o) {
	if (o === null)
		return null;
	if (!Array.isArray(o) && typeof o !== 'object')
		return o;
	
	var output, v, key;
	output = Array.isArray(o) ? [] : {};
	for (key in o) {
		v = o[key];
		output[key] = (typeof v === 'object') ? deepClone(v) : v;
	}

	return output;
}

/**
 * Clone the value by serializing it to JSON and back.
 * @param obj 
 */
export function cloneBySerialization(obj) {
	return JSON.parse(JSON.stringify(obj));
}