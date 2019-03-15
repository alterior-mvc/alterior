import { MetadataName, NgMetadataName, Annotation, AnnotationDecorator } from "@alterior/annotations";

@NgMetadataName('Inject')
@MetadataName('@alterior/di:Injectable')
export class InjectableAnnotation extends Annotation {
}


@NgMetadataName('Optional')
@MetadataName('@alterior/di:Optional')
export class OptionalAnnotation extends Annotation {
}

@NgMetadataName('Inject')
@MetadataName('@alterior/di:Inject')
export class InjectAnnotation extends Annotation {
    constructor(token?) {
        super({ token });
    }

    token : any;

    toString() {
        return `@Inject(${this.token})`;
    }
}

@NgMetadataName('Self')
@MetadataName('@alterior/di:Self')
export class SelfAnnotation extends Annotation {
}

@NgMetadataName('SkipSelf')
@MetadataName('@alterior/di:SkipSelf')
export class SkipSelfAnnotation extends Annotation {
}

@NgMetadataName('Host')
@MetadataName('@alterior/di:Host')
export class HostAnnotation extends Annotation {
}
