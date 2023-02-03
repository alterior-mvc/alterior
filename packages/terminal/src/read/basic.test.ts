import { expect } from "chai"
import { describe } from "razmin"
import { spawnRead } from './fixtures';

import read from './read';

if (process.argv[2] === 'child') {
  child()
} else {
  describe('read', it => {
    it('basic', async () => {
      const { stdout, stderr } = await spawnRead(__filename, {
        'Username: (test-user)': 'a user',
        'Password: (<default hidden>)': 'a password',
        'Password again: (<default hidden>)': 'a password',
      })
    
      expect(JSON.parse(stderr)).to.eql({ user: 'a user', pass: 'a password', verify: 'a password', passMatch: true });
      expect(stdout).to.equal('Username: (test-user) Password: (<default hidden>) Password again: (<default hidden>) ');
    })
    
    it('defaults', async () => {
      const { stdout, stderr } = await spawnRead(__filename, {
        'Username: (test-user)': '',
        'Password: (<default hidden>)': '',
        'Password again: (<default hidden>)': '',
      })
    
      expect(JSON.parse(stderr)).to.eql({ user: 'test-user', pass: 'test-pass', verify: 'test-pass', passMatch: true });
      expect(stdout).to.equal('Username: (test-user) Password: (<default hidden>) Password again: (<default hidden>) ');
    })
    
    it('errors', async () => {
      try {
        await read({ default: {} })
      } catch (e) {
        return;
      }

      throw new Error(`Expected rejection`);
    })
  })
}

async function child () {
  const user = await read({ prompt: 'Username: ', default: 'test-user' })
  const pass = await read({ prompt: 'Password: ', default: 'test-pass', silent: true })
  const verify = await read({ prompt: 'Password again: ', default: 'test-pass', silent: true })

  console.error(JSON.stringify({
    user,
    pass,
    verify,
    passMatch: pass === verify,
  }))

  if (process.stdin.unref) {
    process.stdin.unref()
  }
}
