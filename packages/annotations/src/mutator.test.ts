/// <reference types="reflect-metadata" />

import { getParameterNames } from '@alterior/common';
import { expect } from 'chai';
import { suite } from 'razmin';
import { Mutator } from './mutator';

suite(describe => {
    describe('Mutator.create', it => {
        const RunTwice = () => Mutator.create(value => {
            return function (this: any, ...args: any[]) {
                value.apply(this, args);
                value.apply(this, args);
            }
        }, { validTargets: ['method'] });
        
        it("should mutate the method", () => {
            class Subject {
                value = 0;
                @RunTwice()
                test() {
                    this.value += 1;
                }
            }

            let instance = new Subject();

            expect(instance.value).to.equal(0);
            instance.test();
            expect(instance.value).to.equal(2);
        });
        it("should stack", () => {
            class Subject {
                value = 0;

                @RunTwice()
                @RunTwice()
                test() {
                    this.value += 1;
                }
            }

            let instance = new Subject();

            expect(instance.value).to.equal(0);
            instance.test();
            expect(instance.value).to.equal(4);
        });
        it("should retain parameter name metadata", () => {
            class Subject {
                value = 0;

                @RunTwice()
                test(foobaz: string, blah: string) {
                    this.value += 1;
                }
            }

            let instance = new Subject();
            expect(getParameterNames(instance.test)).to.eql(['foobaz', 'blah']);
        });
        it("should retain parameter name metadata when stacked", () => {
            class Subject {
                value = 0;
                @RunTwice()
                @RunTwice()
                test(foobaz: string, blah: string) {
                    this.value += 1;
                }
            }

            let instance = new Subject();
            expect(getParameterNames(instance.test)).to.eql(['foobaz', 'blah']);
        });
        it("should not replace existing parameter name metadata", () => {
            const AddParams = () => Mutator.create((value, site) => {
                value = function() { }
                Object.defineProperty(value, '__parameterNames', { value: ['synthetic', 'values'] });
                return value;
            }, { validTargets: ['method'] });
            
            class Subject {
                @AddParams()
                test(foobaz: string, blah: string) {
                }
            }

            let instance = new Subject();
            expect(getParameterNames(instance.test)).to.eql(['synthetic', 'values']);
        });
    });
});

