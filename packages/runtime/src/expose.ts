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

		let routes: Exposure[] = (target as any)[EXPOSURES_PROPERTY] || [];
		routes.push(<Exposure>{
			propertyName
		});
	};
}


export class ExposureReflector {
	constructor(type: Function) {
		this.exposures = this.getExposuresFromType(type).map(x => shallowClone(x));
	}

	private getExposuresFromType(type: Function): Exposure[] {
		let parentPrototype = Object.getPrototypeOf(type.prototype);
		let exposures: Exposure[] = (type.prototype[EXPOSURES_PROPERTY] || []);
		if (parentPrototype) {
			return [...this.getExposuresFromType(parentPrototype.constructor), ...exposures];
		} else {
			return [...exposures];
		}
	}

	public exposures: Exposure[];
}