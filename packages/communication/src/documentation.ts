import { Annotation, MetadataName } from "@alterior/annotations";

@MetadataName('@alterior/web-server:MethodDocumentation')
export class DocumentationAnnotation extends Annotation {
    constructor(readonly docs: Documentation) {
        super();
    }
}

export interface Documentation {
    summary?: string;
    description?: string;
}
