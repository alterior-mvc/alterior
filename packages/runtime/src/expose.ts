import { shallowClone } from '@alterior/common';

export interface ExposeOptions {
    
}

export interface Exposure {
    propertyName: string;
}

export const EXPOSURES_PROPERTY = 'alterior:service:exposures';

export function Expose() {
    return function (target: Object, propertyName: string, descriptor: PropertyDescriptor) {
		if (!target.hasOwnProperty(EXPOSURES_PROPERTY)) {
			Object.defineProperty(target, EXPOSURES_PROPERTY, {
				enumerable: false,
				value: []
			});
		}

		let routes = target[EXPOSURES_PROPERTY] || [];
		routes.push(<Exposure>{
			propertyName
		});
	};
}


export class ExposureReflector {
	constructor(type : Function) {
		this.exposures = this.getExposuresFromType(type).map(x => shallowClone(x));
	}

	private getExposuresFromType(type : Function) {
		let parentPrototype = Object.getPrototypeOf(type.prototype);
		let exposures : Exposure[] = (type.prototype[EXPOSURES_PROPERTY] || []);
		if (parentPrototype) {
			return [].concat(...this.getExposuresFromType(parentPrototype.constructor), ...exposures);
		} else {
			return [].concat(...exposures);
		}
	}

	public exposures : Exposure[];
}