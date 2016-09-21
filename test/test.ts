import * as assert from 'assert';
import { suite, test as it } from 'mocha-typescript';

describe('Array', () => {
	@suite class indexOf {
		@it 'should return -1 when the value is not present'() {
			assert.equal(-1, [1,2,3].indexOf(4));
		}
	}
});