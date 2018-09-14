import { describe, it } from 'razmin';
import { Module, Injector } from '@alterior/di';
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
})