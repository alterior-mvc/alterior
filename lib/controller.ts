
export let controllerClasses = [];
export function Controller() {
	return function(target) {
		controllerClasses.push(target);
	}
}