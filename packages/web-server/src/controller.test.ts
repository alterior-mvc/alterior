import { Application, RUNTIME_LOGGER, Runtime, RuntimeLogger } from '@alterior/runtime';
import { provide } from '@alterior/di';
import { expect } from 'chai';
import { suite } from 'razmin';
import { Controller, Mount } from './metadata';
import { WebService } from './service';
import { LOGGING_OPTIONS, LogEvent } from '@alterior/logging';

suite(describe => {
    describe.only('@Controller', it => {
        it('throws error when legacy lifecycle events are encountered', async () => {
            @Controller() class MyController { altOnInit() {} }
            @WebService() class FakeModule { @Mount() controller!: MyController; }
            let result = await Application.bootstrap(FakeModule, { silent: true }).catch(e => e);

            expect(result).to.be.instanceOf(Error);
            expect(result.message).to.equal(
                "Legacy lifecycle events are not supported. Please migrate to Alterior 4 compatible lifecycle events."
            );
        });

        it('logs an error when legacy lifecycle events are encountered', async () => {
            @Controller() class MyController { altOnInit() {} }
            @WebService() class FakeModule { @Mount() controller!: MyController; }

            let errors: LogEvent[] = [];
            await Application.bootstrap(FakeModule, {
                providers: [
                    provide(LOGGING_OPTIONS).usingValue({
                        listeners: [ { async log(message) { errors.push(message); } } ]
                    })
                ]
            }).catch(() => { });
            expect(errors.some(x => x.message.includes("Legacy lifecycle event MyController#altOnInit() is no longer supported")));
        });

        it('executes onInit', async () => {
            let observed = 0;
            @Controller() class MyController { [Controller.onInit]() { observed += 1; } }
            @WebService({ autostart: false }) class FakeModule { @Mount() controller!: MyController; }
            await Application.bootstrap(FakeModule);
            expect(observed).to.equal(1);
        });

        it.only('executes onStart', async () => {
            let observed = 0;
            let captured = 0;
            @Controller() class MyController { [Controller.onStart]() { observed += 1; } }
            @WebService() class FakeModule { @Mount() controller!: MyController; }
            let app = await Application.bootstrap(FakeModule);
            captured = 1;
            await app.stop();
            expect(captured).to.equal(1);
            expect(observed).to.equal(1);
        });

        it.only('executes onStop', async () => {
            let observed = 0;
            let captured = 0;
            @Controller() class MyController { [Controller.onStop]() { observed += 1; } }
            @WebService() class FakeModule { @Mount() controller!: MyController; }
            let app = await Application.bootstrap(FakeModule);
            captured = observed;
            await app.stop();
            expect(captured).to.equal(0);
            expect(observed).to.equal(1);
        });

        it('executes afterStart', async () => {
            let observed = 0;
            let captured = 0;
            @Controller() class MyController { [Controller.afterStart]() { observed += 1; } }
            @WebService() class FakeModule { @Mount() controller!: MyController; }
            let app = await Application.bootstrap(FakeModule);
            captured = observed;
            await app.stop();
            expect(captured).to.equal(1);
            expect(observed).to.equal(1);
        });
        it('executes afterStop', async () => {
            let observed = 0;
            let captured = 0;
            @Controller() class MyController { [Controller.afterStop]() { observed += 1; } }
            @WebService() class FakeModule { @Mount() controller!: MyController; }
            let app = await Application.bootstrap(FakeModule);
            captured = observed;
            await app.stop();
            expect(captured).to.equal(0);
            expect(observed).to.equal(1);
        });
        it('executes onListen', async () => {
            let observed = 0;
            let captured = 0;
            @Controller() class MyController { [Controller.onListen]() { observed += 1; } }
            @WebService() class FakeModule { @Mount() controller!: MyController; }
            let app = await Application.bootstrap(FakeModule);
            captured = observed;
            await app.stop();
            expect(captured).to.equal(1);
            expect(observed).to.equal(1);
        });
    });
});