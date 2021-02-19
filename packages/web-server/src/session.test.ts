import { describe } from "razmin";
import { Session } from "./session";
import { expect } from "chai";
import { RouteEvent } from './metadata';
import { Injectable } from '@alterior/di';

describe('Session', it => {
    it('transparently requests properties via get()', () => {
        class FooSession extends Session {
            bar : number;
        }

        let event = new RouteEvent(<any>{
            session: {
                bar: 123
            }
        }, <any>{});

        RouteEvent.with(event, () => {
            expect(FooSession.current().bar).to.equal(123);
        });
    });
    it.skip('transparently coerces properties based on type', () => {
        function nothing() {
            return (t, p) => {};
        }
        
        @Injectable()
        class FooSession extends Session {
            @nothing()
            bar : number;
        }

        let event = new RouteEvent(<any>{
            session: {
                bar: '123'
            }
        }, <any>{});

        RouteEvent.with(event, () => {
            expect(FooSession.current().bar).to.equal(123);
            expect(FooSession.current().bar).to.be.a('number');
        });
        
        let event2 = new RouteEvent(<any>{
            session: {
                bar: 123
            }
        }, <any>{});

        RouteEvent.with(event2, () => {
            expect(FooSession.current().bar).to.equal(123);
            expect(FooSession.current().bar).to.be.a('number');
        });
    });
});