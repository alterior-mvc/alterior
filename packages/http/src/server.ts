/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as xhr2 from 'xhr2';

import { Provider, inject } from '@alterior/di';
import { Observable, Observer, Subscription } from 'rxjs';
import { HttpBackend, HttpHandler } from './backend';
import { HttpInterceptingHandler } from './module';
import { HttpRequest } from './request';
import { HttpEvent } from './response';
import { BrowserXhr, XhrFactory } from './xhr';

const isAbsoluteUrl = /^[a-zA-Z\-\+.]+:\/\//;

// @ts-ignore unused
function validateRequestUrl(url: string): void {
  if (!isAbsoluteUrl.test(url)) {
    throw new Error(`URLs requested via Http on the server must be absolute. URL: ${url}`);
  }
}

export class ServerXhr implements BrowserXhr {
  build(): XMLHttpRequest { return new xhr2.XMLHttpRequest(); }
}

export abstract class ZoneMacroTaskWrapper<S, R> {
  wrap(request: S): Observable<R> {
    return new Observable((observer: Observer<R>) => {
      let task: Task = null!;
      let scheduled: boolean = false;
      let sub: Subscription | null = null;
      let savedResult: any = null;
      let savedError: any = null;

      const scheduleTask = (_task: Task) => {
        task = _task;
        scheduled = true;

        const delegate = this.delegate(request);
        sub = delegate.subscribe(
          res => savedResult = res,
          err => {
            if (!scheduled) {
              throw new Error(
                'An http observable was completed twice. This shouldn\'t happen, please file a bug.');
            }
            savedError = err;
            scheduled = false;
            task.invoke();
          },
          () => {
            if (!scheduled) {
              throw new Error(
                'An http observable was completed twice. This shouldn\'t happen, please file a bug.');
            }
            scheduled = false;
            task.invoke();
          });
      };

      const cancelTask = (_task: Task) => {
        if (!scheduled) {
          return;
        }
        scheduled = false;
        if (sub) {
          sub.unsubscribe();
          sub = null;
        }
      };

      const onComplete = () => {
        if (savedError !== null) {
          observer.error(savedError);
        } else {
          observer.next(savedResult);
          observer.complete();
        }
      };

      // MockBackend for Http is synchronous, which means that if scheduleTask is by
      // scheduleMacroTask, the request will hit MockBackend and the response will be
      // sent, causing task.invoke() to be called.
      const _task = Zone.current.scheduleMacroTask(
        'ZoneMacroTaskWrapper.subscribe', onComplete, {}, () => null, cancelTask);
      scheduleTask(_task);

      return () => {
        if (scheduled && task) {
          task.zone.cancelTask(task);
          scheduled = false;
        }
        if (sub) {
          sub.unsubscribe();
          sub = null;
        }
      };
    });
  }

  protected abstract delegate(request: S): Observable<R>;
}

export class ZoneClientBackend extends ZoneMacroTaskWrapper<HttpRequest<any>, HttpEvent<any>> implements HttpBackend {
  private backend = inject(HttpInterceptingHandler);

  handle(request: HttpRequest<any>): Observable<HttpEvent<any>> { return this.wrap(request); }

  protected delegate(request: HttpRequest<any>): Observable<HttpEvent<any>> {
    return this.backend.handle(request);
  }
}

export const SERVER_HTTP_PROVIDERS: Provider[] = [
  { provide: XhrFactory, useClass: ServerXhr },
  { provide: HttpHandler, useClass: ZoneClientBackend },
  HttpInterceptingHandler
];