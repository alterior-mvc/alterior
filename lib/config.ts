import { Provider, ValueProvider } from '@angular/core';

export class AppConfiguration {
	constructor(data) {
		for (let key in data)
			this[key] = data[key];
	}

	static provide(data) : Provider {
		return {
			provide: this,
			useValue: new this(data)
		};
	}
}
