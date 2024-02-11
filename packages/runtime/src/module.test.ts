import { describe, it } from 'razmin';
import { Module, Injector, InjectionToken, inject, ConfiguredModule } from '@alterior/di';
import { Application } from './application';
import { expect } from 'chai';
import { Time, Environment } from '@alterior/common';
import { injectionContext } from '@alterior/di/dist/injection';

describe("Modules", () => {
    it('allows injection of the Injector', async () => {
        let sawInjector: Injector | null = null;
        @Module()
        class TestModule {
            constructor() {
                sawInjector = injectionContext().injector;
            }
        }

        await Application.bootstrap(TestModule);

        expect(sawInjector).not.to.be.null;

        let directInjectedInjector = sawInjector!.get(Injector as any);

        expect(directInjectedInjector).not.to.be.null;
        expect(directInjectedInjector).to.equal(sawInjector);

    });

    it('uses providers for dependency injection', async () => {
        let sawFoo: number | null = null;
        const FOO = new InjectionToken<number>('FOO');

        @Module({
            providers: [
                { provide: FOO, useValue: 123 }
            ]
        })
        class TestModule {
            constructor() {
                sawFoo = inject(FOO);
            }
        }

        await Application.bootstrap(TestModule);
        expect(sawFoo).to.eq(123);
    });
    it('provides providers of imported modules', async () => {
        let sawFoo: number | null = null;
        const FOO = new InjectionToken<number>('FOO');

        @Module({
            providers: [
                { provide: FOO, useValue: 123456 }
            ]
        })
        class SubModule { }

        @Module({
            imports: [SubModule]
        })
        class TestModule {
            constructor() {
                sawFoo = inject(FOO);
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(application.runtime.instances.find(x => x.definition.target === SubModule)).to.exist;
        expect(sawFoo).to.eq(123456);
    });
    it('does not fail with multiple instances of the same shared dependency', async () => {
        let sawFoo: number | null = null;
        const FOO = new InjectionToken<number>('FOO');
        @Module({
            providers: [
                { provide: FOO, useValue: 123456 }
            ]
        })
        class DependencyModule { }

        @Module({
            imports: [DependencyModule]
        })
        class SubModule { }

        @Module({
            imports: [SubModule, DependencyModule]
        })
        class TestModule {
            constructor() {
                sawFoo = inject(FOO);
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(application.runtime.instances.filter(x => x.definition.target === SubModule).length).to.eq(1);
        expect(sawFoo).to.eq(123456);
    });
    it('does not fail with multiple differently configured instances of the same shared dependency', async () => {
        let sawFoo: string | null = null;
        let sawBar: number | null = null;

        interface DependencyConfigInterface {
            foo?: string;
            bar?: number;
        }

        class DependencyConfig implements DependencyConfigInterface {
            constructor(config: DependencyConfigInterface) {
                Object.assign(this, config);
            }

            foo: string = 'abcdef';
            bar: number = 98765;
        }

        class DependencyService {
            private config = inject(DependencyConfig, { optional: true });

            getFoo() {
                return this.config?.foo;
            }

            getBar() {
                return this.config?.bar;
            }
        }

        @Module({
            providers: [DependencyService]
        })
        class DependencyModule {
            static configure(config: DependencyConfigInterface) {
                return {
                    $module: DependencyModule,
                    providers: [
                        { provide: DependencyConfig, useValue: new DependencyConfig(config) }
                    ]
                }
            }
        }

        @Module({
            imports: [DependencyModule]
        })
        class SubModule { }

        @Module({
            imports: [SubModule, DependencyModule.configure({ bar: 999 })]
        })
        class TestModule {
            service = inject(DependencyService);
            constructor() {
                sawFoo = this.service.getFoo() ?? null;
                sawBar = this.service.getBar() ?? null;
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(application.runtime.instances.filter(x => x.definition.target === SubModule).length).to.eq(1);
        expect(sawFoo).to.eq('abcdef');
        expect(sawBar).to.eq(999);
    });
    it('runs the constructors of all modules in dependency-order', async () => {
        let log = '';

        @Module()
        class DependencyModule {
            constructor() { log += 'dependency;' }
        }

        @Module({
            imports: [DependencyModule]
        })
        class SubModule {
            constructor() { log += 'sub;' }
        }

        @Module({
            imports: [SubModule, DependencyModule]
        })
        class TestModule {
            constructor() { log += 'test;' }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(application.runtime.instances.filter(x => x.definition.target === SubModule).length).to.eq(1);
        expect(log).to.eq('dependency;sub;test;');
    });

    it('runs the altOnInit of all modules in dependency-order', async () => {
        let log = '';

        @Module()
        class DependencyModule {
            altOnInit() { log += 'dependency;' }
        }

        @Module({
            imports: [DependencyModule]
        })
        class SubModule {
            altOnInit() { log += 'sub;' }
        }

        @Module({
            imports: [SubModule, DependencyModule]
        })
        class TestModule {
            altOnInit() { log += 'test;' }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(application.runtime.instances.filter(x => x.definition.target === SubModule).length).to.eq(1);
        expect(log).to.eq('dependency;sub;test;');
    });

    it('injects Time', async () => {
        let observedTime: Time | undefined;
        let baseTime = Date.now();

        @Module()
        class TestModule {
            constructor() {
                observedTime = inject(Time);
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(observedTime).to.exist;
        expect(observedTime).to.be.instanceOf(Time);
        expect(typeof observedTime!.now() === 'number');
        expect(observedTime!.now()).to.be.at.least(baseTime);
    });

    it('allows Time to be overridden', async () => {
        let observedTime: Time | undefined;
        let specialDate = new Date();

        class FakeTime extends Time {
            now() {
                return 123;
            }

            current() {
                return specialDate;
            }
        }

        @Module({
            providers: [{ provide: Time, useClass: FakeTime }]
        })
        class TestModule {
            constructor() {
                observedTime = inject(Time);
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(observedTime).to.exist;
        expect(observedTime).to.be.instanceOf(FakeTime);
        expect(observedTime!.now()).to.equal(123);
        expect(observedTime!.current()).to.equal(specialDate);
    });

    it('injects Environment', async () => {
        let observedEnv: Environment | undefined;
        @Module()
        class TestModule {
            constructor() {
                observedEnv = inject(Environment);
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(observedEnv).to.exist;
        expect(observedEnv).to.be.instanceOf(Environment);
    });

    it('allows Environment to be overridden', async () => {
        let observedEnv: Environment | undefined;

        class FakeEnvironment extends Environment {

        }

        @Module({ providers: [{ provide: Environment, useClass: FakeEnvironment }] })
        class TestModule {
            constructor() {
                observedEnv = inject(Environment);
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(observedEnv).to.exist;
        expect(observedEnv).to.be.instanceOf(FakeEnvironment);
    });

    it('allows an injection token within a module', async () => {
        let log = '';

        const ITEM = new InjectionToken<{ foo: number }>('A THING');

        class Options {
            readonly options = inject(ITEM);
        }

        class MyService {
            readonly options = inject(Options);
        }

        @Module()
        class DependencyModule {
            static configure() {
                return <ConfiguredModule>{
                    $module: DependencyModule,
                    providers: [
                        { provide: ITEM, useValue: { foo: 123 } },
                        Options,
                        MyService
                    ]
                }
            }
        }

        @Module({
            imports: [DependencyModule.configure()]
        })
        class TestModule {
            private service = inject(MyService);

            altOnInit() {
                log += this.service.options.options.foo;
            }
        }

        let application = await Application.bootstrap(TestModule);

        expect(application.runtime).to.exist;
        expect(log).to.eq('123');
    });

})