
export function shallowClone(obj : Object) {
	if (typeof obj !== 'object')
		return obj;
	
	let clone = Object.create(obj.constructor.prototype);
	Object.assign(clone, obj);
	return clone;
}

export function clone(obj) {
	return cloneBySerialization(obj);
}

export function deepClone(o) {
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

export function cloneBySerialization(obj) {
	return JSON.parse(JSON.stringify(obj));
}