/**
 * @license
 * Copyright Google Inc. All Rights Reserved.JsonpCallbackContext
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {describe, it, beforeEach} from 'razmin';
import {expect} from 'chai';

import {Injectable, Module, Injector} from '@alterior/di';

//import {TestBed} from '@angular/core/testing';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Application} from '@alterior/runtime';
import {HttpHandler} from '../backend';
import {HttpClient} from '../client';
import {HTTP_INTERCEPTORS, HttpInterceptor} from '../interceptor';
import {HttpRequest} from '../request';
import {HttpEvent, HttpResponse} from '../response';
import {HttpTestingController} from '../testing/api';
import {HttpClientTestingModule} from '../testing/module';
import {TestRequest} from '../testing/request';

class TestInterceptor implements HttpInterceptor {
  constructor(private value: string) {}

  intercept(req: HttpRequest<any>, delegate: HttpHandler): Observable<HttpEvent<any>> {    
    const existing = req.headers.get('Intercepted');
    const next = !!existing ? existing + ',' + this.value : this.value;
    req = req.clone({setHeaders: {'Intercepted': next}});
    return delegate.handle(req).pipe(map(event => {
      if (event instanceof HttpResponse) {
        const existing = event.headers.get('Intercepted');
        const next = !!existing ? existing + ',' + this.value : this.value;
        return event.clone({headers: event.headers.set('Intercepted', next)});
      }
      return event;
    }));
  }
}

class InterceptorA extends TestInterceptor {
  constructor() { super('A'); }
}

class InterceptorB extends TestInterceptor {
  constructor() { super('B'); }
}

@Injectable()
class ReentrantInterceptor implements HttpInterceptor {
  constructor(private client: HttpClient) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req);
  }
}

{
  describe('HttpClientModule', async () => {
    let injector: Injector;
    beforeEach(async () => {
      @Module({
        imports: [HttpClientTestingModule],
        providers: [
          {provide: HTTP_INTERCEPTORS, useClass: InterceptorA, multi: true},
          {provide: HTTP_INTERCEPTORS, useClass: InterceptorB, multi: true}
        ]
      })
      class TestModule {

      }

      let app = await Application.bootstrap(TestModule);

      injector = app.injector
    });
    it('initializes HttpClient properly', done => {
      injector.get(HttpClient).get('/test', {responseType: 'text'}).subscribe(value => {
        expect(value).to.equal('ok!');
        done();
      });

      let thing = injector.get(HttpTestingController);
      injector.get(HttpTestingController).expectOne('/test').flush('ok!');
    });

    it('intercepts outbound responses in the order in which interceptors were bound', done => {
      injector.get(HttpClient)
          .get('/test', {observe: 'response', responseType: 'text'})
          .subscribe(value => done());
      const req = injector.get(HttpTestingController).expectOne('/test') as TestRequest;
      expect(req.request.headers.get('Intercepted')).to.equal('A,B');
      req.flush('ok!');
    });
    it('intercepts inbound responses in the right (reverse binding) order', done => {
      injector.get(HttpClient)
          .get('/test', {observe: 'response', responseType: 'text'})
          .subscribe(value => {
            expect(value.headers.get('Intercepted')).to.equal('B,A');
            done();
          });
      injector.get(HttpTestingController).expectOne('/test').flush('ok!');
    });
    it('allows interceptors to inject HttpClient', async (done) => {

      @Module({
        imports: [HttpClientTestingModule],
        providers: [
          {provide: HTTP_INTERCEPTORS, useClass: ReentrantInterceptor, multi: true},
        ],
      })
      class TestModule {}

      let app = await Application.bootstrap(TestModule);
      let injector = app.injector;
      
      injector.get(HttpClient).get('/test').subscribe(() => { done(); });
      injector.get(HttpTestingController).expectOne('/test').flush('ok!');
    });
  });
}
