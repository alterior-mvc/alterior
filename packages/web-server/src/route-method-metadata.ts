import { IAnnotation } from "@alterior/annotations";

export interface RouteMethodMetadata {
	returnType: any;
	paramTypes: any[];
	paramNames: any[];
	pathParamNames: any[];
	paramAnnotations: IAnnotation[][];
}
