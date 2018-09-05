import * as assert from 'assert';
import { Annotation, IAnnotation, METHOD_PARAMETER_ANNOTATIONS_KEY, ANNOTATIONS_KEY, PROPERTY_ANNOTATIONS_KEY, CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY, AnnotationTargetError, Annotations, MetadataName } from './annotations';

import { suite } from 'razmin';

const META_NAME = 'altTests:Label';
const LABEL = 'this is the label';
const REGULAR_PROPERTY_VALUE = 123;

@MetadataName(META_NAME)
class LabelAnnotation extends Annotation {
    constructor(
        public text : string
    ) {
        super();
    }

    regularProperty : number = REGULAR_PROPERTY_VALUE;
}

const Label = LabelAnnotation.decorator();

function assertClone(annotation : LabelAnnotation, clone : LabelAnnotation) {
    assert(annotation !== clone);
    assert(Object.getPrototypeOf(annotation) === Object.getPrototypeOf(clone));
    assert(clone.regularProperty === annotation.regularProperty);
    assert(clone.text === annotation.text);
}

suite(describe => {
    describe('Annotations', it => {
        it("should be able to list class annotations", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
    
            @MultiLabel(LABEL)
            @MultiLabel(`foobar`)
            class TestSubject {
    
            }
    
            class EmptySubject {}
            assert(Annotations.getClassAnnotations(EmptySubject));
    
            let annotations = Annotations.getClassAnnotations(TestSubject);
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            assert(matchingAnnotations.length === 2);
    
            assert(matchingAnnotations.find((x : any) => x.text === 'foobar'));
            assert(matchingAnnotations.find((x : any) => x.text === LABEL));
        });
    
        it("should be able to list method annotations", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
    
            class TestSubject {
    
                @MultiLabel(LABEL)
                @MultiLabel(`foobar`)
                helloWorld() {
    
                }
            }
    
            class EmptySubject { helloWorld() { } }
            assert(Annotations.getMethodAnnotations(EmptySubject, 'helloWorld'));
    
            let annotations = Annotations.getMethodAnnotations(TestSubject, 'helloWorld');
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            assert(matchingAnnotations.length === 2);
    
            assert(matchingAnnotations.find((x : any) => x.text === 'foobar'));
            assert(matchingAnnotations.find((x : any) => x.text === LABEL));
        });
    
        it("should be able to list property annotations", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            class TestSubject {
    
                @MultiLabel(LABEL)
                @MultiLabel(`foobar`)
                stuff : number = 123;
            }
    
            class EmptySubject { stuff : number = 123; }
            assert(Annotations.getMethodAnnotations(EmptySubject, 'stuff'));
    
            let annotations = Annotations.getMethodAnnotations(TestSubject, 'stuff');
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            assert(matchingAnnotations.length === 2);
    
            assert(matchingAnnotations.find((x : any) => x.text === 'foobar'));
            assert(matchingAnnotations.find((x : any) => x.text === LABEL));
        })
    
        it("should be able to list method parameter annotations", () => {
            class TestSubject {
                helloStrings(@Label(LABEL) param1 : string, @Label(`foobar`) param2 : string) {
                    console.log(`hello ${param1}, ${param2}`);
                }
            }
    
            class EmptySubject { 
                helloStrings(param1 : string, param2 : string) {
                }
            }
            assert(Annotations.getParameterAnnotations(EmptySubject, 'helloStrings'));
    
            let annotations = Annotations.getParameterAnnotations(TestSubject, 'helloStrings');
            assert(annotations.length === 2, `Value should be 2 not ${annotations.length}`);
    
            assert(annotations[0].find((x : any) => x.text === LABEL));
            assert(annotations[1].find((x : any) => x.text === 'foobar'));
        })
    
        it("should be able to list constructor parameter annotations", () => {
            class TestSubject {
                constructor(@Label(LABEL) param1 : string, @Label(`foobar`) param2 : string) {
                }
            }
    
            class EmptySubject { 
                constructor(param1 : string, param2 : string) {
                }
            }
            assert(Annotations.getConstructorParameterAnnotations(EmptySubject));
    
            let annotations = Annotations.getConstructorParameterAnnotations(TestSubject);
            assert(annotations.length == 2);
    
            assert(annotations[0].find((x : any) => x.text === LABEL));
            assert(annotations[1].find((x : any) => x.text === 'foobar'));
        });
    
        it("should be able to clone an IAnnotation", () => {
            let annotation1 = new LabelAnnotation(LABEL);
            let annotation2 = Annotations.clone(annotation1);
            assertClone(annotation1, annotation2);
        });
    });

    describe('Annotation', it => {
        it("should be cloneable", () => {
            let annotation1 = new LabelAnnotation(LABEL);
            let annotation2 = annotation1.clone();
            assertClone(annotation1, annotation2);
        });
    
        it("should apply to classes", () => {
            class TestSubject {}
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToClass(TestSubject);
            
            assert((TestSubject as any)[ANNOTATIONS_KEY]);
            assert((TestSubject as any)[ANNOTATIONS_KEY].length > 0);
    
            let installedAnnotations : IAnnotation[] = 
                (TestSubject as any)[ANNOTATIONS_KEY]
                    .filter(x => x.$metadataName == META_NAME)
            ;
    
            assert(installedAnnotations.length === 1);
            assert(!!installedAnnotations[0]);
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
    
            assert(annotationP.$metadataName === META_NAME);
            assert(annotationP.constructor === LabelAnnotation);
            assert(annotationP.regularProperty === REGULAR_PROPERTY_VALUE);
    
            assertClone(annotation, annotationP);
        });
    
        it("should apply to methods", () => {
            class TestSubject {
                helloWorld() {
                    console.log('hello world');
                }
            }
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToMethod(TestSubject, 'helloWorld');
            
            assert((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]);
            assert((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld']);
    
            let installedAnnotations : IAnnotation[] = 
                (TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld']
                    .filter(x => x.$metadataName == META_NAME)
            ;
    
            assert(installedAnnotations.length === 1);
            assert(!!installedAnnotations[0]);
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            assert(annotationP.$metadataName === META_NAME);
            assert(annotationP.constructor === LabelAnnotation);
            assert(annotationP.regularProperty === REGULAR_PROPERTY_VALUE);
    
            assertClone(annotation, annotationP);
        });
        
        it("should apply to properties", () => {
            class TestSubject {
                helloWorld() {
                    console.log('hello world');
                }
            }
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToMethod(TestSubject, 'helloWorld');
            
            assert((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]);
            assert((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld']);
    
            let installedAnnotations : IAnnotation[] = 
                (TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld']
                    .filter(x => x.$metadataName == META_NAME)
            ;
    
            assert(installedAnnotations.length === 1);
            assert(!!installedAnnotations[0]);
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            assert(annotationP.$metadataName === META_NAME);
            assert(annotationP.constructor === LabelAnnotation);
            assert(annotationP.regularProperty === REGULAR_PROPERTY_VALUE);
            
            assertClone(annotation, annotationP);
        });
        
        it("should apply to method parameters", () => {
            class TestSubject {
                helloString(param1 : string) {
                    console.log(`hello ${param1}`);
                }
            }
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToParameter(TestSubject, 'helloString', 0);
            
            assert((TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]);
            assert((TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloString']);
    
            let paramAnnotations : IAnnotation[][] = 
                (TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloString'];
    
            assert(
                paramAnnotations.length === 1, 
                `Should be 1 entry to match 1 parameter on TestSubject.helloString(), ` 
                + `not ${paramAnnotations.length}`
            );
    
            let installedAnnotations : IAnnotation[] = 
                paramAnnotations[0]
                    .filter(x => x.$metadataName === META_NAME)
            ;
    
            assert(installedAnnotations.length === 1, `Should be 1, not ${installedAnnotations.length}`);
            assert(!!installedAnnotations[0]);
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            assert(annotationP.$metadataName === META_NAME);
            assert(annotationP.constructor === LabelAnnotation);
            assert(annotationP.regularProperty === REGULAR_PROPERTY_VALUE);
            
            assertClone(annotation, annotationP);
        });
        
        it("should fill missing parameter metadata slots with null", () => {
            class TestSubject {
                helloStrings(param1 : string, param2 : string) {
                    console.log(`hello ${param1}, ${param2}`);
                }
            }
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToParameter(TestSubject, 'helloStrings', 1);
            
            assert((TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]);
            assert((TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloStrings']);
    
            let paramAnnotations : IAnnotation[][] = 
                (TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloStrings'];
    
            assert(
                paramAnnotations.length === 2, 
                `Should be 2 entries to match 2 parameters on TestSubject.helloStrings(), ` 
                + `not ${paramAnnotations.length}`
            );
    
            assert(paramAnnotations[0] === null);
            assert(paramAnnotations[2] === undefined);
    
            let installedAnnotations : IAnnotation[] = 
                paramAnnotations[1]
                    .filter(x => x.$metadataName === META_NAME)
            ;
    
            assert(installedAnnotations.length === 1, `Should be 1, not ${installedAnnotations.length}`);
            assert(!!installedAnnotations[0]);
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            assert(annotationP.$metadataName === META_NAME);
            assert(annotationP.constructor === LabelAnnotation);
            assert(annotationP.regularProperty === REGULAR_PROPERTY_VALUE);
            
            assertClone(annotation, annotationP);
        });
        
        it("should apply to constructor parameters", () => {
            class TestSubject {
                constructor(param1 : string) {
                    console.log(`hello ${param1}`);
                }
            }
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToConstructorParameter(TestSubject, 0);
            
            assert((TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY]);
    
            let paramAnnotations : IAnnotation[][] = 
                (TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    
            assert(
                paramAnnotations.length === 1, 
                `Should be 1 entry to match 1 parameter on TestSubject.helloString(), ` 
                + `not ${paramAnnotations.length}`
            );
    
            let installedAnnotations : IAnnotation[] = 
                paramAnnotations[0]
                    .filter(x => x.$metadataName === META_NAME)
            ;
    
            assert(installedAnnotations.length === 1, `Should be 1, not ${installedAnnotations.length}`);
            assert(!!installedAnnotations[0]);
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            assert(annotationP.$metadataName === META_NAME);
            assert(annotationP.constructor === LabelAnnotation);
            assert(annotationP.regularProperty === REGULAR_PROPERTY_VALUE);
            
            assertClone(annotation, annotationP);
        });
        
        it("should fill missing constructor parameter metadata slots with null", () => {
            class TestSubject {
                constructor(param1 : string, param2 : string) {
                    console.log(`hello ${param1}, ${param2}`);
                }
            }
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToConstructorParameter(TestSubject, 1);
            
            assert((TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY]);
    
            let paramAnnotations : IAnnotation[][] = 
                (TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    
            assert(
                paramAnnotations.length === 2, 
                `Should be 2 entries to match 2 parameters on new TestSubject(param1, param2), ` 
                + `not ${paramAnnotations.length}`
            );
    
            assert(paramAnnotations[0] === null);
            assert(paramAnnotations[2] === undefined);
    
            let installedAnnotations : IAnnotation[] = 
                paramAnnotations[1]
                    .filter(x => x.$metadataName === META_NAME)
            ;
    
            assert(installedAnnotations.length === 1, `Should be 1, not ${installedAnnotations.length}`);
            assert(!!installedAnnotations[0]);
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            assert(annotationP.$metadataName === META_NAME);
            assert(annotationP.constructor === LabelAnnotation);
            assert(annotationP.regularProperty === REGULAR_PROPERTY_VALUE);
            
            assertClone(annotation, annotationP);
        });
        
        it("should be able to construct a viable decorator", () => {
            let decorator = LabelAnnotation.decorator();
    
            assert(typeof decorator === 'function');
            
            let annotationDecorator = decorator(LABEL);
            let obj = {};
    
            annotationDecorator(obj);
    
            assert(obj[ANNOTATIONS_KEY]);
            assert(obj[ANNOTATIONS_KEY].filter(x => x.$metadataName === META_NAME).length === 1);
            assert(obj[ANNOTATIONS_KEY].find(x => x.$metadataName === META_NAME).text === LABEL);
        });
    
        it("should handle class decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            @decorator(LABEL)
            class TestSubject {
            }
            
            assert(TestSubject[ANNOTATIONS_KEY]);
            assert(TestSubject[ANNOTATIONS_KEY].filter(x => x.$metadataName === META_NAME).length === 1);
            assert(TestSubject[ANNOTATIONS_KEY].find(x => x.$metadataName === META_NAME).text === LABEL);
        });
        
        it("should handle method decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            class TestSubject {
                @decorator(LABEL)
                helloWorld() {
                    console.log('hello world');
                }
            }
            
            assert(TestSubject.prototype[PROPERTY_ANNOTATIONS_KEY]);
            assert(TestSubject.prototype[PROPERTY_ANNOTATIONS_KEY]['helloWorld']);
            assert(TestSubject.prototype[PROPERTY_ANNOTATIONS_KEY]['helloWorld'].filter(x => x.$metadataName === META_NAME).length === 1);
            assert(TestSubject.prototype[PROPERTY_ANNOTATIONS_KEY]['helloWorld'].find(x => x.$metadataName === META_NAME).text === LABEL);
        });
        
        it("should handle property decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            class TestSubject {
                @decorator(LABEL)
                stuff : number = 123;
            }
            
            assert(TestSubject.prototype[PROPERTY_ANNOTATIONS_KEY]);
            assert(TestSubject.prototype[PROPERTY_ANNOTATIONS_KEY]['stuff']);
            assert(TestSubject.prototype[PROPERTY_ANNOTATIONS_KEY]['stuff'].filter(x => x.$metadataName === META_NAME).length === 1);
            assert(TestSubject.prototype[PROPERTY_ANNOTATIONS_KEY]['stuff'].find(x => x.$metadataName === META_NAME).text === LABEL);
        });
        
        it("should handle method parameters decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            class TestSubject {
                helloWorld(@decorator(LABEL) stuff : string) {
    
                }
            }
            
            assert(TestSubject.prototype[METHOD_PARAMETER_ANNOTATIONS_KEY]);
            assert(TestSubject.prototype[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloWorld']);
    
            let parameters = TestSubject.prototype[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloWorld'];
    
            assert(parameters.length == 1);
            
            let paramAnnotations = parameters[0];
    
            assert(paramAnnotations.filter(x => x.$metadataName === META_NAME).length === 1);
            assert(paramAnnotations.find(x => x.$metadataName === META_NAME).text === LABEL);
        });
        
        it("should handle constructor parameters decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            class TestSubject {
                constructor(@decorator(LABEL) stuff : string) {
    
                }
            }
            
            assert(TestSubject[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY]);
            let parameters = TestSubject[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    
            assert(parameters.length == 1);
            
            let paramAnnotations = parameters[0];
    
            assert(paramAnnotations.filter(x => x.$metadataName === META_NAME).length === 1);
            assert(paramAnnotations.find(x => x.$metadataName === META_NAME).text === LABEL);
        });
        
        it("should ensure a decorator is applied only to supported targets", () => {
            let decorator = LabelAnnotation.decorator({
                validTargets: ['class', 'parameter']
            });
    
            @decorator(LABEL)
            class TestSubject { constructor(@decorator(LABEL) stuff : string) { } }
            
            try {
                class BrokenSubject { @decorator(LABEL) helloWorld() { } }
    
                assert(false, `The decorator allowed usage on 'method' when only 'class' and 'parameter' should be allowed.`);
            } catch (e) {
                assert(e instanceof AnnotationTargetError);
            }
        });
    });
});

