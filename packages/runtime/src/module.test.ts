import { describe, it } from 'razmin';
import { Module, Injector, Inject, Injectable, Optional } from '@alterior/di';
import { Application } from './application';
import { expect } from 'chai';

describe("Modules", () => {
    it('allows injection of the Injector', () => {
        let sawInjector : Injector = null;
        @Module({

        })
        class TestModule {
            constructor(injector : Injector) {
                sawInjector = injector;
            }
        }

        Application.bootstrap(TestModule);

        expect(sawInjector).not.to.be.null;

        let directInjectedInjector = sawInjector.get(Injector);

        expect(directInjectedInjector).not.to.be.null;
        expect(directInjectedInjector).to.equal(sawInjector);

    });

    it('uses providers for dependency injection', async () => {
        let sawFoo : number = null;

        @Module({
            providers: [
                { provide: "foo", useValue: 123 }
            ]
        })
        class TestModule {
            constructor(@Inject('foo') foo : number) {
                sawFoo = foo;
            }
        }

        await Application.bootstrap(TestModule);
        expect(sawFoo).to.eq(123);
    });
    it('imports declarations of imported modules', async () => {
        let sawFoo : number = null;
        
        @Module({
            providers: [ 
                { provide: "foo", useValue: 123456 }
            ]
        })
        class SubModule {}

        @Module({
            imports: [ SubModule ]
        })
        class TestModule {
            constructor(@Inject('foo') foo : number) {
                sawFoo = foo;
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(application.runtime.instances.find(x => x.definition.target === SubModule)).to.exist;
        expect(sawFoo).to.eq(123456);
    });
    it('does not fail with multiple instances of the same shared dependency', async () => {
        let sawFoo : number = null;
        
        @Module({
            providers: [ 
                { provide: "foo", useValue: 123456 }
            ]
        })
        class DependencyModule {}

        @Module({
            imports: [ DependencyModule ]
        })
        class SubModule {}

        @Module({
            imports: [ SubModule, DependencyModule ]
        })
        class TestModule {
            constructor(@Inject('foo') foo : number) {
                sawFoo = foo;
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(application.runtime.instances.filter(x => x.definition.target === SubModule).length).to.eq(1);
        expect(sawFoo).to.eq(123456);
    });
    it('does not fail with multiple differently configured instances of the same shared dependency', async () => {
        let sawFoo : string = null;
        let sawBar : number = null;
        
        interface DependencyConfigInterface {
            foo? : string;
            bar? : number;
        }

        @Injectable()
        class DependencyConfig implements DependencyConfigInterface {
            constructor(private config : DependencyConfigInterface) {
                Object.assign(this, config);
            }

            foo : string = 'abcdef';
            bar : number = 98765;
        }

        @Injectable()
        class DependencyService {
            constructor(
                @Optional()
                private config : DependencyConfig
            ) {
            }

            getFoo() {
                return this.config.foo;
            }

            getBar() {
                return this.config.bar;
            }
        }

        @Module({
            providers: [ DependencyService ]
        })
        class DependencyModule {
            static configure(config : DependencyConfigInterface) {
                return {
                    $module: DependencyModule,
                    providers: [
                        { provide: DependencyConfig, useValue: new DependencyConfig(config) }
                    ]
                }
            }
        }

        @Module({
            imports: [ DependencyModule ]
        })
        class SubModule {}

        @Module({
            imports: [ SubModule, DependencyModule.configure({ bar: 999 }) ]
        })
        class TestModule {
            constructor(service : DependencyService) {
                sawFoo = service.getFoo();
                sawBar = service.getBar();
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(application.runtime.instances.filter(x => x.definition.target === SubModule).length).to.eq(1);
        expect(sawFoo).to.eq('abcdef');
        expect(sawBar).to.eq(999);
    });
})