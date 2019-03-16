import { suite } from "razmin";
import { ConsoleTrace, setTracingEnabled, getTracingEnabled } from "./trace";
import { interceptConsole } from "@alterior/common";
import { expect } from 'chai';

suite(describe => {
    describe('ConsoleTrace', it => {
        it('reasonably traces a program', () => {
            let wasTracingEnabled = getTracingEnabled();
            setTracingEnabled(true);
            
            try {
                let log = [];

                interceptConsole((method, original, console, args) => {
                    log.push({ method, original, console, args });
                }, () => {
                    class Thing {
                        @ConsoleTrace()
                        static doSomething(data : any, stuff : number) {
                            console.log("Doing something...");
                            try {
                                this.doAnotherThing(stuff);
                            } catch (e) {
        
                            }
                        }
        
                        @ConsoleTrace()
                        static doAnotherThing(stuff : number) {
                            console.log("Doing another thing...");
                            throw new Error('Uh oh');
                        }
                    }
        
                    let thing = new Thing();
                    Thing.doSomething({ stuff: 321, other: "nice" }, 12333); 
                });

                expect(log.length).to.eq(8);

                expect(log[0].args[0]).to.contain('Thing#doSomething');
                expect(log[0].args[0]).to.contain('{');

                expect(log[1].args[0]).to.contain('Doing something...');

                expect(log[2].args[0]).to.contain('Thing#doAnotherThing');
                expect(log[2].args[0]).to.contain('{');

                expect(log[3].args[0]).to.contain('Doing another thing...');
                expect(log[4].args[0]).to.contain('Exception');
                expect(log[5].args[0]).to.contain('Error: Uh oh');
                expect(log[6].args[0]).to.contain('}');
                expect(log[7].args[0]).to.contain('}');
            } finally {
                setTracingEnabled(wasTracingEnabled);
            }
        });
    });
});