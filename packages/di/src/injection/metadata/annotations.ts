import { MetadataName, Annotation } from "@alterior/annotations";

@MetadataName('@alterior/di:Injectable')
export class InjectableAnnotation extends Annotation {
}


@MetadataName('@alterior/di:Optional')
export class OptionalAnnotation extends Annotation {
}

@MetadataName('@alterior/di:Inject')
export class InjectAnnotation extends Annotation {
    constructor(token?: any) {
        super({ token });
    }

    token : any;

    toString() {
        return `@Inject(${this.token})`;
    }
}

@MetadataName('@alterior/di:Self')
export class SelfAnnotation extends Annotation {
}

@MetadataName('@alterior/di:SkipSelf')
export class SkipSelfAnnotation extends Annotation {
}

@MetadataName('@alterior/di:Host')
export class HostAnnotation extends Annotation {
}
