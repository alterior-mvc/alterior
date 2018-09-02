import { Controller } from "./controller";
import { Get, RouteEvent } from "./route";
import { ServiceDescriptionRef, ApplicationOptionsRef } from "./bootstrap";
import { ExpressRef } from "./express-ref";

export interface OpenApiContact {
    name : string;
    email : string;
    url : string;
}

export interface OpenApiServiceInfo {
    title : string;
    description : string;
    contact? : OpenApiContact;
    version : string;
}

export interface OpenApiSecurityDefinition {

}

export interface OpenApiSecurityDefinitionMap {
    [key : string] : OpenApiSecurityDefinition;
}

export interface OpenApiTag {
    name : string;
    description : string;
}

export interface OpenApiComponents {
    schemas : OpenApiMap<OpenApiSchema>;
}
export interface OpenApiService {
    info : OpenApiServiceInfo;
    openapi : string;
    tags : (OpenApiTag | string)[];
    paths : OpenApiMap<OpenApiMap<OpenApiOperation>>;
    components : OpenApiComponents;
}

export interface OpenApiResponseMap {
    [status : string] : OpenApiResponse;
}

export interface OpenApiResponse {
    description? : string;
    schema? : OpenApiSchemaRef;
}

export interface OpenApiSchemaRef {
    type? : string;
    $ref? : string;
}

export interface OpenApiParameter {
    in? : string;
    name? : string;
    schema? : OpenApiSchemaRef;
    format? : string;
    required? : boolean;
    example? : any;
}

export interface OpenApiOperation {
    operationId : string;
    summary : string;
    description : string;
    parameters : OpenApiParameter[];
    responses : OpenApiResponseMap;
    tags : (OpenApiTag | string)[];
}

export interface OpenApiMap<T> {
    [key : string] : T;
}

export interface OpenApiSchema {
    type : "object";
    properties : OpenApiDefinitionPropertyMap;
    required : string[];
    description : string;
}

export interface OpenApiDefinitionPropertyMap {
    [name : string] : OpenApiDefinitionProperty;
}

export interface OpenApiDefinitionProperty {
    type? : string;
    format? : string;
    description? : string;
    $ref? : string;
}

@Controller('', {
    autoRegister: false,
    group: 'openapi'
})
export class OpenApiController {
    constructor(
        private serviceDescriptionRef : ServiceDescriptionRef,
        private expressRef : ExpressRef
    ) {
    }

    @Get('')
    home(ev : RouteEvent) : OpenApiService {
        let desc = this.serviceDescriptionRef.description;

        let info : OpenApiServiceInfo = {
            title: desc.name,
            description: desc.description,
            version: this.serviceDescriptionRef.description.version || '0.0.0'
        };
        let paths : OpenApiMap<OpenApiMap<OpenApiOperation>> = {};
        let components : OpenApiComponents = {} as any;
        let securityDefinitions : OpenApiMap<OpenApiSecurityDefinition> = {};
        let tags : (OpenApiTag | string)[] = [];

        for (let route of desc.routes) {
            let oapiPathName = route.path.replace(/:([A-Za-z0-9]+)/g, '{$1}');
            let loweredHttpMethod = route.httpMethod.toLowerCase();

            if (!paths[oapiPathName])
                paths[oapiPathName] = {};

            paths[oapiPathName][loweredHttpMethod] = {
                operationId: route.method,
                summary: (route.definition.options || {}).summary,
                description: (route.definition.options || {}).description,
                parameters: route.parameters.map(routeParam => ({
                    in: routeParam.type,
                    name: routeParam.name,
                    schema: {
                        type: 'string' // TODO
                    },
                    required: routeParam.type == 'path' ? true : (routeParam.required || false)
                })),
                responses: Object.assign({
                    '4XX': {
                        description: 'Invalid request'
                    },
                    '5XX': {
                        description: 'Unexpected error'
                    }
                }),
                tags: route.group ? [ route.group ] : []
            };
        }

        return {
            openapi: '3.0.0',
            info,
            tags,
            paths,
            components
        };
    }
}