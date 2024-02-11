/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {describe, it} from 'razmin';

import {HttpClient} from '../../src/client';
import {HttpClientTestingBackend} from './backend';
import {expect} from 'chai';
import { Injector } from '@alterior/di';
import { HttpBackend } from '../backend';

describe('HttpClient TestRequest', () => {
  it('accepts a null body', () => {
    const mock = new HttpClientTestingBackend();
    const client = Injector.construct(HttpClient, [ { provide: HttpBackend, useValue: mock } ]);

    let resp: any;
    client.post('/some-url', {test: 'test'}).subscribe(body => { resp = body; });

    const req = mock.expectOne('/some-url');
    req.flush(null);

    expect(resp).to.be.null;
  });
});
