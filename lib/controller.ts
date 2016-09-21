
export let controllerClasses = [];
export function Controller() {
	return function(target) {
		controllerClasses.push(target);
	}
}

export class ControllerBase {
	respondWith(member : Function) {
		var self = this;
		return function() {
			member.apply(self, arguments);
		}
	}
}