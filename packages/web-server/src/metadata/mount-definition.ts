import { MountOptions } from "./mount-options";

export interface MountDefinition {
	path?: string;
	controller: Function;
	options: MountOptions;
	propertyKey: string;
}