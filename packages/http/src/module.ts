/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { ConfiguredModule, Module, inject } from '@alterior/di';
import { Observable } from 'rxjs';

import { injectionContext } from '@alterior/di/dist/injection';
import { HttpBackend, HttpHandler } from './backend';
import { HttpClient } from './client';
import { HTTP_INTERCEPTORS, HttpInterceptor, HttpInterceptorHandler, NoopInterceptor } from './interceptor';
import { HttpRequest } from './request';
import { HttpEvent } from './response';
import { SERVER_HTTP_PROVIDERS } from './server';
import { BrowserXhr, HttpXhrBackend, XhrFactory } from './xhr';
import { HttpXsrfInterceptor, XSRF_COOKIE_NAME, XSRF_HEADER_NAME } from './xsrf';

/**
 * An injectable `HttpHandler` that applies multiple interceptors
 * to a request before passing it to the given `HttpBackend`.
 *
 * The interceptors are loaded lazily from the injector, to allow
 * interceptors to themselves inject classes depending indirectly
 * on `HttpInterceptingHandler` itself.
 * @see `HttpInterceptor`
 */
export class HttpInterceptingHandler implements HttpHandler {
  private chain: HttpHandler | null = null;
  private backend = inject(HttpBackend);
  private injector = injectionContext().injector;

  handle(req: HttpRequest<any>): Observable<HttpEvent<any>> {
    if (this.chain === null) {
      const interceptors = this.injector.get(HTTP_INTERCEPTORS, []);
      this.chain = interceptors.reduceRight(
        (next, interceptor) => new HttpInterceptorHandler(next, interceptor), this.backend);
    }

    return this.chain.handle(req);
  }
}

/**
 * Constructs an `HttpHandler` that applies interceptors
 * to a request before passing it to the given `HttpBackend`.
 *
 * Use as a factory function within `HttpClientModule`.
 *
 *
 */
export function interceptingHandler(
  backend: HttpBackend, interceptors: HttpInterceptor[] | null = []): HttpHandler {
  if (!interceptors) {
    return backend;
  }
  return interceptors.reduceRight(
    (next, interceptor) => new HttpInterceptorHandler(next, interceptor), backend);
}

/**
 * Factory function that determines where to store JSONP callbacks.
 *
 * Ordinarily JSONP callbacks are stored on the `window` object, but this may not exist
 * in test environments. In that case, callbacks are stored on an anonymous object instead.
 *
 *
 */
export function jsonpCallbackContext(): Object {
  if (typeof window === 'object') {
    return window;
  }
  return {};
}

/**
 * An NgModule that adds XSRF protection support to outgoing requests.
 *
 * For a server that supports a cookie-based XSRF protection system,
 * use directly to configure XSRF protection with the correct
 * cookie and header names.
 *
 * If no names are supplied, the default cookie name is `XSRF-TOKEN`
 * and the default header name is `X-XSRF-TOKEN`.
 *
 *
 */
@Module({
  providers: [
    HttpXsrfInterceptor,
    { provide: HTTP_INTERCEPTORS, useExisting: HttpXsrfInterceptor, multi: true },
    { provide: XSRF_COOKIE_NAME, useValue: 'XSRF-TOKEN' },
    { provide: XSRF_HEADER_NAME, useValue: 'X-XSRF-TOKEN' },
  ],
})
export class HttpClientXsrfModule {
  /**
   * Disable the default XSRF protection.
   */
  static disable(): ConfiguredModule {
    return {
      $module: HttpClientXsrfModule,
      providers: [
        { provide: HttpXsrfInterceptor, useClass: NoopInterceptor },
      ],
    };
  }

  /**
   * Configure XSRF protection.
   * @param options An object that can specify either or both
   * cookie name or header name.
   * - Cookie name default is `XSRF-TOKEN`.
   * - Header name default is `X-XSRF-TOKEN`.
   *
   */
  static withOptions(options: {
    cookieName?: string,
    headerName?: string,
  } = {}): ConfiguredModule {
    return {
      $module: HttpClientXsrfModule,
      providers: [
        options.cookieName ? { provide: XSRF_COOKIE_NAME, useValue: options.cookieName } : [],
        options.headerName ? { provide: XSRF_HEADER_NAME, useValue: options.headerName } : [],
      ],
    };
  }
}

/**
 * An NgModule that provides the `HttpClient` and associated services.
 *
 * Interceptors can be added to the chain behind `HttpClient` by binding them
 * to the multiprovider for `HTTP_INTERCEPTORS`.
 *
 *
 */
@Module({
  /**
   * Optional configuration for XSRF protection.
   */
  imports: [
    // HttpClientXsrfModule.withOptions({
    //   cookieName: 'XSRF-TOKEN',
    //   headerName: 'X-XSRF-TOKEN',
    // }),
  ],
  /**
   * The module provides `HttpClient` itself, and supporting services.
   */
  providers: [
    HttpClient,
    { provide: HttpHandler, useClass: HttpInterceptingHandler },
    HttpXhrBackend,
    { provide: HttpBackend, useExisting: HttpXhrBackend },
    BrowserXhr,
    { provide: XhrFactory, useExisting: BrowserXhr },
  ],
})
export class HttpClientModule {

  public static forRoot(config?: HttpClientConfig) {
    let providers = [];

    if (!config)
      config = {};

    if (!config.platform) {
      // Autodetect the backend

      if (typeof document !== 'undefined')
        config.platform = 'browser';
      else
        config.platform = 'server';
    }

    if (config.platform === 'server') {
      providers.push(...SERVER_HTTP_PROVIDERS);
    } else if (config.platform === 'browser') {
      // Default configuration is browser.
    }

    return { $module: HttpClientModule, providers };
  }

}

export interface HttpClientConfig {
  /**
   * Which HTTP client implementation should be used? 
   * Use 'server' to use the `xhr2` NPM module. Use `browser` to 
   * use the browser-side `XMLHttpRequest`, and set to `null` 
   * to disable loading a built-in implementation (so you can 
   * provide your own).
   */
  platform?: 'server' | 'browser' | null;
}