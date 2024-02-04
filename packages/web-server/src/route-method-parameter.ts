import { IAnnotation } from "@alterior/annotations";
import { WebEvent } from "./metadata";
import { RouteParamDescription } from "./route-param-description";
import { InputAnnotation } from "./input";
import { HttpError } from "@alterior/common";
import { RouteInstance } from "./route-instance";

/**
 * Represents a parameter of a route-handling Typescript method. 
 */
export class RouteMethodParameter<T = any> {
	constructor(
		readonly route: RouteInstance,
		readonly target: Function,
		readonly methodName: string,
		readonly index: number,
		readonly name: string,
		readonly type: any,
		readonly annotations: IAnnotation[]
	) {
		let { descriptionType, descriptionName, factory } = this.createFactory();

		this.description = {
			name: descriptionName ?? this.name,
			type: descriptionType,
			description: `An instance of ${this.type}`
		};

		factory = this.createCoerciveFactory(factory);
		
		this.factory = async ev => factory(ev);
	}

	readonly factory: (ev: WebEvent) => Promise<T>;
	readonly description: RouteParamDescription;
	readonly inputAnnotation = this.annotations.find(x => x instanceof InputAnnotation) as InputAnnotation;

	async resolve(ev: WebEvent) {
		return await this.factory(ev);
	}

	private createCoerciveFactory(factory: (ev: WebEvent) => any): (ev: WebEvent) => any {
		let paramType = this.type;
		if (paramType === Number) {
			return ev => {
				let value = factory(ev);

				// Do not try to validate `undefined` (ie the parameter is not present)

				if (value === void 0)
					return value;

				let number = parseFloat(value);
				if (isNaN(number)) {
					throw new HttpError(400, {
						error: 'invalid-request',
						message: `The parameter ${this.description.name} must be a valid number`
					});
				}

				return number;
			}
		} else if (paramType === Boolean) {
			return ev => {
				let value = factory(ev);
				if (value === void 0)
					return value;

				return !['', 'no', '0', 'false', 'off'].includes(`${value}`.toLowerCase());
			}
		} else if (paramType === Date) {
			return ev => {
				let value = factory(ev);
				if (value === void 0)
					return value;

				let date = new Date(value);

				if (!date.getDate()) {
					throw new HttpError(400, {
						error: 'invalid-request',
						message: `The parameter ${this.description.name} must be a valid timestamp`
					});
				}
			}
		} else if (paramType === String) {
			return ev => {
				let value = factory(ev);
				if (value === undefined || value === null)
					return value;

				return '' + value;
			}
		}

		return factory;
	}

	private createFactory(): { descriptionType: string, descriptionName?: string, factory: (ev: WebEvent) => any } {
		let simpleTypes = [String, Number];
		let paramNameFactories: Record<string, (ev: WebEvent) => any> = {
			body: (ev: WebEvent) => ev.request.body,
			session: (ev: WebEvent) => ev.request.session
		};

		let inputAnnotation = this.inputAnnotation;
		if (inputAnnotation) {
			return {
				descriptionName: inputAnnotation.name,
				descriptionType: inputAnnotation.type,
				factory: this.createInputFactory()
			};
		} else if (this.type === WebEvent) {
			return {
				descriptionType: 'web-event',
				factory: ev => ev
			};
		} else if (this.route.params.find(x => x == this.name) && simpleTypes.includes(this.type)) {
			// Name based matching for path parameters
			return {
				descriptionType: 'path',
				factory: (ev: WebEvent) => ev.request['params'] ? ev.request['params'][this.name] : undefined
			};
		} else if (paramNameFactories[this.name]) {
			// Well-known names
			return {
				descriptionType: this.name,
				factory: paramNameFactories[this.name]
			};
		}

		let sanitizedType = this.type ? (this.type.name || '<unknown>') : '<undefined>';
		throw new Error(
			`Unable to fulfill route method parameter '${this.name}' of type '${sanitizedType}'\r\n`
			+ (this.route.params.find(x => x == this.name)
				? `There is a path parameter (:${this.name}) but it was not bound because `
				+ `the method parameter is not one of ${simpleTypes.map(x => x.name).join(', ')}.\r\n`
				: ``
			)
			+ `While preparing route ${this.route.definition.method} ${this.route.definition.path} `
			+ `with method ${this.route.definition.method}()`
		);
	}

	private createInputFactory() {
		let input = this.inputAnnotation;
		let inputName = input.name || this.name;
		let typeFactories: Record<string, (ev: WebEvent) => any> = {
			path: (ev: WebEvent) => ev.request.params?.[inputName],
			queryParam: (ev: WebEvent) => ev.request.query?.[inputName],
			queryParams: (ev: WebEvent) => ev.request.query ?? {},
			session: (ev: WebEvent) => input.name ?
				ev.request.session?.[input.name]
				: ev.request.session,
			body: (ev: WebEvent) => ev.request.body
		};

		if (!typeFactories[input.type])
			throw new Error(`Unsupported parameter type '${input.type}' used on parameter '${this.name}'`);

		let factory = typeFactories[input.type];

		if (input.default !== void 0) {
			let originalFactory = factory;
			factory = (ev: WebEvent) => originalFactory(ev) ?? input.default;
		}

		return factory;
	}
}
