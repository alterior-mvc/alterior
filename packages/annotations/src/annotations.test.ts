/// <reference types="reflect-metadata" />

import { Annotation, IAnnotation, METHOD_PARAMETER_ANNOTATIONS_KEY, ANNOTATIONS_KEY, PROPERTY_ANNOTATIONS_KEY, CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY, AnnotationTargetError, Annotations, MetadataName } from './annotations';
import { expect, assert } from 'chai';
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
    
        it("should be able to list both subclass and superclass annotations", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            @MultiLabel(LABEL)
            @MultiLabel(`foobar`)
            class TestSubject {
            }

            @MultiLabel(`thing2`)
            class SubTestSubject extends TestSubject {}
    
            let annotations = Annotations.getClassAnnotations(SubTestSubject);
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            assert(matchingAnnotations.length === 3);
    
            assert(matchingAnnotations.find((x : any) => x.text === 'foobar'));
            assert(matchingAnnotations.find((x : any) => x.text === LABEL));
            assert(matchingAnnotations.find((x : any) => x.text === 'thing2'));
        });
    
        it("should not list subclass annotations on superclasses", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            @MultiLabel(LABEL)
            @MultiLabel(`foobar`)
            class TestSubject {
            }

            @MultiLabel(`thing2`)
            class SubTestSubject extends TestSubject {}
    
            let annotations = Annotations.getClassAnnotations(TestSubject);
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            assert(matchingAnnotations.length === 2);
    
            assert(matchingAnnotations.find((x : any) => x.text === 'foobar'));
            assert(matchingAnnotations.find((x : any) => x.text === LABEL));
        });

        it("should pass an instanceof check", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            @MultiLabel(LABEL)
            class TestSubject {
            }

            let annotations = Annotations.getClassAnnotations(TestSubject);
            expect(annotations.filter(x => x instanceof LabelAnnotation).length).to.equal(1);

            let annotation = annotations.find(x => x instanceof LabelAnnotation);

            expect((<LabelAnnotation>annotation).text).to.equal(LABEL);
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
            expect(Annotations.getMethodAnnotations(EmptySubject, 'helloWorld')).to.exist;
    
            let annotations = Annotations.getMethodAnnotations(TestSubject, 'helloWorld');
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            expect(matchingAnnotations.length).to.equal(2);
    
            expect(matchingAnnotations.find((x : any) => x.text === 'foobar')).to.exist;
            expect(matchingAnnotations.find((x : any) => x.text === LABEL)).to.exist;
        });
    
        it("should be able to list both subclass and superclass method annotations", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            class TestSubject {
    
                @MultiLabel(LABEL)
                @MultiLabel(`foobar`)
                stuff() : number {
                    return 123;
                }
            }

            class SubTestSubject extends TestSubject {
                @MultiLabel(`thing2`)
                stuff() : number {
                    return 321;
                }
            }
    
            let annotations = Annotations.getMethodAnnotations(SubTestSubject, 'stuff');
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            expect(matchingAnnotations.length).to.equal(3);
    
            expect(matchingAnnotations.find((x : any) => x.text === 'foobar')).to.exist;
            expect(matchingAnnotations.find((x : any) => x.text === LABEL)).to.exist;
            expect(matchingAnnotations.find((x : any) => x.text === 'thing2')).to.exist;
        })

        it("should not list subclass method annotations on the superclass", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            class TestSubject {
    
                @MultiLabel(LABEL)
                @MultiLabel(`foobar`)
                stuff() { 
                    return 123;
                }
            }

            class SubTestSubject extends TestSubject {
                @MultiLabel(`thing2`)
                stuff() {
                    return 321;
                }
            }
    
            let annotations = Annotations.getMethodAnnotations(TestSubject, 'stuff');
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            expect(matchingAnnotations.length).to.equal(2);
    
            expect(matchingAnnotations.find((x : any) => x.text === 'foobar')).to.exist;
            expect(matchingAnnotations.find((x : any) => x.text === LABEL)).to.exist;
        })

        it("should be able to list property annotations", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            class TestSubject {
    
                @MultiLabel(LABEL)
                @MultiLabel(`foobar`)
                stuff : number = 123;
            }
    
            class EmptySubject { stuff : number = 123; }
            expect(Annotations.getMethodAnnotations(EmptySubject, 'stuff')).to.exist;
    
            let annotations = Annotations.getMethodAnnotations(TestSubject, 'stuff');
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            expect(matchingAnnotations.length).to.equal(2);
    
            expect(matchingAnnotations.find((x : any) => x.text === 'foobar')).to.exist;
            expect(matchingAnnotations.find((x : any) => x.text === LABEL)).to.exist;
        })

        it("should be able to list both subclass and superclass property annotations", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            class TestSubject {
    
                @MultiLabel(LABEL)
                @MultiLabel(`foobar`)
                stuff : number = 123;
            }

            class SubTestSubject extends TestSubject {
                @MultiLabel(`thing2`)
                stuff : number = 321;
            }
    
            let annotations = Annotations.getPropertyAnnotations(SubTestSubject, 'stuff');
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            expect(matchingAnnotations.length).to.equal(3);
    
            expect(matchingAnnotations.find((x : any) => x.text === 'foobar')).to.exist;
            expect(matchingAnnotations.find((x : any) => x.text === LABEL)).to.exist;
            expect(matchingAnnotations.find((x : any) => x.text === 'thing2')).to.exist;
        })

        it("should not list subclass property annotations on the superclass", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });
            class TestSubject {
    
                @MultiLabel(LABEL)
                @MultiLabel(`foobar`)
                stuff : number = 123;
            }

            class SubTestSubject extends TestSubject {
                @MultiLabel(`thing2`)
                stuff : number = 321;
            }
    
            let annotations = Annotations.getPropertyAnnotations(TestSubject, 'stuff');
            let matchingAnnotations = annotations.filter(x => x.$metadataName == META_NAME);
            expect(matchingAnnotations.length).to.equal(2);
    
            expect(matchingAnnotations.find((x : any) => x.text === 'foobar')).to.exist;
            expect(matchingAnnotations.find((x : any) => x.text === LABEL)).to.exist;
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
            
            expect(Annotations.getParameterAnnotations(EmptySubject, 'helloStrings')).to.exist;
    
            let annotations = Annotations.getParameterAnnotations(TestSubject, 'helloStrings');
            expect(annotations.length).to.equal(2);
    
            expect(annotations[0].find((x : any) => x.text === LABEL)).to.exist;
            expect(annotations[1].find((x : any) => x.text === 'foobar')).to.exist;
        })
    
        it("should be able to list method parameter annotations on methods named as array methods", () => {
            class TestSubject {
                splice(@Label(LABEL) param1 : string, @Label(`foobar`) param2 : string) {
                    console.log(`hello ${param1}, ${param2}`);
                }
            }
    
            class EmptySubject { 
                splice(param1 : string, param2 : string) {
                }
            }
            
            expect(Annotations.getParameterAnnotations(EmptySubject, 'splice')).to.exist;
    
            let annotations = Annotations.getParameterAnnotations(TestSubject, 'splice');
            expect(annotations.length).to.equal(2);
    
            expect(annotations[0].find((x : any) => x.text === LABEL)).to.exist;
            expect(annotations[1].find((x : any) => x.text === 'foobar')).to.exist;
        })
        it("should be able to list both subclass and superclass method parameter annotations", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });

            class TestSubject {
                helloStrings5(@MultiLabel(LABEL) @MultiLabel('other') param1 : string, @MultiLabel(`foobar`) param2 : string) {
                    console.log(`hello ${param1}, ${param2}`);
                }
            }
    
            class SubTestSubject extends TestSubject { 
                helloStrings5(@MultiLabel(`thing2`) param1 : string, param2 : string, @MultiLabel(`thing3`) param3?: string) {
                }
            }

            let annotations = Annotations.getParameterAnnotations(SubTestSubject, 'helloStrings5');
            
            expect(annotations).to.exist;
            expect(annotations.length).to.equal(3);
    
            expect(annotations[0].length).to.equal(3);
            expect(annotations[0].find((x : any) => x.text === LABEL)).to.exist;
            expect(annotations[0].find((x : any) => x.text === 'other')).to.exist;
            expect(annotations[0].find((x : any) => x.text === 'thing2')).to.exist;
            
            expect(annotations[1].length).to.equal(1);
            expect(annotations[1].find((x : any) => x.text === 'foobar')).to.exist;
            
            expect(annotations[2].length).to.equal(1);
            expect(annotations[2].find((x : any) => x.text === 'thing3')).to.exist;
        })
    
        it("should not list subclass method parameter annotations on the superclass", () => {
            let MultiLabel = LabelAnnotation.decorator({ allowMultiple: true });

            class TestSubject {
                helloStrings2(@MultiLabel(LABEL) param1 : string, @MultiLabel(`foobar`) param2 : string) {
                    console.log(`hello ${param1}, ${param2}`);
                }
            }
    
            class EmptySubject { 
                helloStrings2(@MultiLabel(`thing2`) param1 : string, param2 : string, @MultiLabel(`thing3`) param3: string) {
                }
            }
            expect(Annotations.getParameterAnnotations(TestSubject, 'helloStrings2')).to.exist;
    
            let annotations = Annotations.getParameterAnnotations(TestSubject, 'helloStrings2');
            expect(annotations.length).to.equal(2);
    
            expect(annotations[0].length).to.equal(1);
            expect(annotations[0].find((x : any) => x.text === LABEL)).to.exist;
            
            expect(annotations[1].length).to.equal(1);
            expect(annotations[1].find((x : any) => x.text === 'foobar')).to.exist;
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
            expect(Annotations.getConstructorParameterAnnotations(EmptySubject)).to.exist;
    
            let annotations = Annotations.getConstructorParameterAnnotations(TestSubject);
            expect(annotations.length).to.equal(2);
    
            expect(annotations[0].find((x : any) => x.text === LABEL)).to.exist;
            expect(annotations[1].find((x : any) => x.text === 'foobar')).to.exist;
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
    
        it.skip("should not complain when an ApplyOnce decorator is applied to both superclass and subclass", () => {
            @Label('foo')
            class Superclass {

            }

            @Label('foo2')
            class Subclass {

            }

            let annotations = Annotations.getClassAnnotations(Subclass);

            expect(annotations.length).to.equal(1); // ???
        });

        it("should apply to classes", () => {
            class TestSubject {}
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToClass(TestSubject);
            
            expect((TestSubject as any)[ANNOTATIONS_KEY]).to.exist;
            expect((TestSubject as any)[ANNOTATIONS_KEY].length > 0).to.exist;
    
            let installedAnnotations : IAnnotation[] = 
                ((TestSubject as any)[ANNOTATIONS_KEY] as any[])
                    .filter(x => x.$metadataName == META_NAME)
            ;
    
            expect(installedAnnotations.length).to.equal(1);
            expect(installedAnnotations[0]).to.be.ok;
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
    
            expect(annotationP.$metadataName).to.equal(META_NAME);
            expect(annotationP.constructor).to.equal(LabelAnnotation);
            expect(annotationP.regularProperty).to.equal(REGULAR_PROPERTY_VALUE);
    
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
            
            expect((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]).to.exist;
            expect((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld']).to.exist;
    
            let installedAnnotations : IAnnotation[] = 
                ((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld'] as any[])
                    .filter(x => x.$metadataName == META_NAME)
            ;
    
            expect(installedAnnotations.length).to.equal(1);
            expect(installedAnnotations[0]).to.be.ok;
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            expect(annotationP.$metadataName).to.equal(META_NAME);
            expect(annotationP.constructor).to.equal(LabelAnnotation);
            expect(annotationP.regularProperty).to.equal(REGULAR_PROPERTY_VALUE);
    
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
            
            expect((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]).to.exist;
            expect((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld']).to.exist;
    
            let installedAnnotations : IAnnotation[] = 
                ((TestSubject as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld'] as any[])
                    .filter(x => x.$metadataName == META_NAME)
            ;
    
            expect(installedAnnotations.length).to.equal(1);
            expect(installedAnnotations[0]).to.be.ok;
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            expect(annotationP.$metadataName).to.equal(META_NAME);
            expect(annotationP.constructor).to.equal(LabelAnnotation);
            expect(annotationP.regularProperty).to.equal(REGULAR_PROPERTY_VALUE);
            
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
            
            expect((TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]).to.exist;
            expect((TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloString']).to.exist;
    
            let paramAnnotations : IAnnotation[][] = 
                (TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloString'];
    
            expect(paramAnnotations.length)
                .to.equal(1,  
                    `Should be 1 entry to match 1 parameter on TestSubject.helloString(), ` 
                    + `not ${paramAnnotations.length}`
                )
            ;
    
            let installedAnnotations : IAnnotation[] = 
                paramAnnotations[0]
                    .filter(x => x.$metadataName === META_NAME)
            ;
    
            expect(installedAnnotations.length).to.equal(1);
            expect(installedAnnotations[0]).to.be.ok;
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            expect(annotationP.$metadataName).to.equal(META_NAME);
            expect(annotationP.constructor).to.equal(LabelAnnotation);
            expect(annotationP.regularProperty).to.equal(REGULAR_PROPERTY_VALUE);
            
            assertClone(annotation, annotationP);
        });
        
        it("should fill missing parameter metadata slots with null", () => {
            class TestSubject {
                helloStrings3(param1 : string, param2 : string) {
                    console.log(`hello ${param1}, ${param2}`);
                }
            }
    
            let annotation = new LabelAnnotation(LABEL);
            annotation.applyToParameter(TestSubject, 'helloStrings3', 1);
            
            expect((TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]).to.exist;
            expect((TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloStrings3']).to.exist;
    
            let paramAnnotations : IAnnotation[][] = 
                (TestSubject as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloStrings3'];
    
            expect(paramAnnotations.length)
                .to.equal(2,
                    `Should be 2 entries to match 2 parameters on TestSubject.helloStrings(), ` 
                    + `not ${paramAnnotations.length}`
                )
            ;
    
            expect(paramAnnotations[0]).to.be.null;
            expect(paramAnnotations[2]).to.be.undefined;
    
            let installedAnnotations : IAnnotation[] = 
                paramAnnotations[1]
                    .filter(x => x.$metadataName === META_NAME)
            ;
    
            expect(installedAnnotations.length).to.equal(1);
            expect(installedAnnotations[0]).to.be.ok;
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            expect(annotationP.$metadataName).to.equal(META_NAME);
            expect(annotationP.constructor).to.equal(LabelAnnotation);
            expect(annotationP.regularProperty).to.equal(REGULAR_PROPERTY_VALUE);
            
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
            
            expect((TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY]).to.exist;
    
            let paramAnnotations : IAnnotation[][] = 
                (TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    
            expect(paramAnnotations.length)
                .to.equal(1, 
                `Should be 1 entry to match 1 parameter on TestSubject.helloString(), ` 
                + `not ${paramAnnotations.length}`
                )
            ;
    
            let installedAnnotations : IAnnotation[] = 
                paramAnnotations[0]
                    .filter(x => x.$metadataName === META_NAME)
            ;
    
            expect(installedAnnotations.length).to.equal(1);
            expect(installedAnnotations[0]).to.be.ok;
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            expect(annotationP.$metadataName).to.equal(META_NAME);
            expect(annotationP.constructor).to.equal(LabelAnnotation);
            expect(annotationP.regularProperty).to.equal(REGULAR_PROPERTY_VALUE);
            
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
            
            expect((TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY]).to.exist;
    
            let paramAnnotations : IAnnotation[][] = 
                (TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    
            expect(paramAnnotations.length)
                .to.equal(2, 
                    `Should be 2 entries to match 2 parameters on new TestSubject(param1, param2), ` 
                    + `not ${paramAnnotations.length}`
                )
            ;
    
            expect(paramAnnotations[0]).to.be.null
            expect(paramAnnotations[2]).to.be.undefined;
    
            let installedAnnotations : IAnnotation[] = 
                paramAnnotations[1]
                    .filter(x => x.$metadataName === META_NAME)
            ;
    
            expect(installedAnnotations.length).to.equal(1);
            expect(installedAnnotations[0]).to.be.ok;
    
            let installedAnnotation = installedAnnotations[0];
            let annotationP = installedAnnotation as LabelAnnotation;
            
            expect(annotationP.$metadataName).to.equal(META_NAME);
            expect(annotationP.constructor).to.equal(LabelAnnotation);
            expect(annotationP.regularProperty).to.equal(REGULAR_PROPERTY_VALUE);
            
            assertClone(annotation, annotationP);
        });
        
        it("should be able to construct a viable decorator", () => {
            let decorator = LabelAnnotation.decorator();
    
            expect(typeof decorator).to.equal('function');
            
            let annotationDecorator = decorator(LABEL);
            let obj = {} as any;
    
            annotationDecorator(obj);
    
            expect(obj[ANNOTATIONS_KEY]).to.exist;
            expect((obj[ANNOTATIONS_KEY] as any[]).filter(x => x.$metadataName === META_NAME).length === 1).to.exist;
            expect((obj[ANNOTATIONS_KEY] as any[]).find(x => x.$metadataName === META_NAME).text === LABEL).to.exist;
        });
    
        it("should handle class decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            @decorator(LABEL)
            class TestSubject {
            }
            
            expect((TestSubject as any)[ANNOTATIONS_KEY]).to.exist;
            expect(((TestSubject as any)[ANNOTATIONS_KEY] as any[])
                .filter(x => x.$metadataName === META_NAME).length === 1).to.exist;

            expect(((TestSubject as any)[ANNOTATIONS_KEY] as any[])
                .find(x => x.$metadataName === META_NAME).text === LABEL).to.exist;

        });
        
        it("should handle method decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            class TestSubject {
                @decorator(LABEL)
                helloWorld() {
                    console.log('hello world');
                }
            }
            
            expect((TestSubject.prototype as any)[PROPERTY_ANNOTATIONS_KEY]).to.exist;
            expect((TestSubject.prototype as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld']).to.exist;
            expect(((TestSubject.prototype as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld'] as any[])
                .filter(x => x.$metadataName === META_NAME).length === 1).to.exist;

            expect(((TestSubject.prototype as any)[PROPERTY_ANNOTATIONS_KEY]['helloWorld'] as any[])
                .find(x => x.$metadataName === META_NAME).text === LABEL).to.exist;

        });
        
        it("should handle property decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            class TestSubject {
                @decorator(LABEL)
                stuff : number = 123;
            }
            
            expect((TestSubject.prototype as any)[PROPERTY_ANNOTATIONS_KEY]).to.exist;
            expect((TestSubject.prototype as any)[PROPERTY_ANNOTATIONS_KEY]['stuff']).to.exist;
            expect(((TestSubject.prototype as any)[PROPERTY_ANNOTATIONS_KEY]['stuff'] as any[])
                .filter(x => x.$metadataName === META_NAME).length === 1).to.exist;
                
            expect(((TestSubject.prototype as any)[PROPERTY_ANNOTATIONS_KEY]['stuff'] as any[])
                .find(x => x.$metadataName === META_NAME).text === LABEL).to.exist;
                
        });
        
        it("should handle method parameters decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            class TestSubject {
                helloWorld(@decorator(LABEL) stuff : string) {
    
                }
            }
            
            expect((TestSubject.prototype as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]).to.exist;
            expect((TestSubject.prototype as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloWorld']).to.exist;
    
            let parameters = (TestSubject.prototype as any)[METHOD_PARAMETER_ANNOTATIONS_KEY]['helloWorld'];
    
            expect(parameters.length).to.equal(1);
            
            let paramAnnotations = parameters[0] as any[];
    
            expect(paramAnnotations.filter(x => x.$metadataName === META_NAME).length).to.equal(1);
            expect(paramAnnotations.find(x => x.$metadataName === META_NAME).text).to.equal(LABEL);
        });
        
        it("should handle constructor parameters decorators", () => {
            let decorator = LabelAnnotation.decorator();
    
            class TestSubject {
                constructor(@decorator(LABEL) stuff : string) {
    
                }
            }
            
            expect((TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY]).to.exist;
            let parameters = (TestSubject as any)[CONSTRUCTOR_PARAMETERS_ANNOTATIONS_KEY];
    
            expect(parameters.length).to.equal(1);
            
            let paramAnnotations = parameters[0] as any[];
    
            expect(paramAnnotations.filter(x => x.$metadataName === META_NAME).length === 1).to.exist;
            expect(paramAnnotations.find(x => x.$metadataName === META_NAME).text === LABEL).to.exist;
        });
        
        it("should ensure a decorator is applied only to supported targets", () => {
            let decorator = LabelAnnotation.decorator({
                validTargets: ['class', 'parameter']
            });
    
            @decorator(LABEL)
            class TestSubject { constructor(@decorator(LABEL) stuff : string) { } }
            
            try {
                class BrokenSubject { @decorator(LABEL) helloWorld() { } }
                throw new Error("The decorator allowed usage on 'method' when only 'class' and 'parameter' should be allowed.");
            } catch (e) {
                expect(e).to.be.instanceOf(AnnotationTargetError);
            }
        });
    });
});

