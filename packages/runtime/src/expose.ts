import { shallowClone } from '@alterior/common';

export interface ExposeOptions {
    
}

export interface Exposure {
    propertyName: string;
}

export const EXPOSURES_PROPERTY = 'alterior:service:exposures';

interface HasExposures {
    ['alterior:service:exposures']: Exposure[];
}

export function Expose() {
    return function (target: Object, propertyName: string, descriptor: PropertyDescriptor) {
		if (!target.hasOwnProperty(EXPOSURES_PROPERTY)) {
			Object.defineProperty(target, EXPOSURES_PROPERTY, {
				enumerable: false,
				value: []
			});
		}

		(target as HasExposures)[EXPOSURES_PROPERTY].push({ propertyName });
	};
}


export class ExposureReflector {
	constructor(type : Function) {
		this.exposures = this.getExposuresFromType(type).map(x => shallowClone(x));
	}

	private getExposuresFromType(type : Function): Exposure[] {
		let parentPrototype = Object.getPrototypeOf(type.prototype);
		let exposures : Exposure[] = (type.prototype[EXPOSURES_PROPERTY] || []);
		if (parentPrototype) {
			return ([] as Exposure[]).concat(...this.getExposuresFromType(parentPrototype.constructor), ...exposures);
		} else {
			return ([] as Exposure[]).concat(...exposures);
		}
	}

	public exposures : Exposure[];
}