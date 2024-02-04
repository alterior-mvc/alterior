import { expect } from 'chai';
import { describe } from 'razmin';
import { spawnRead } from './fixtures';
import { read } from './read';

const times = new Array(18).fill(null).map((_, i) => (i + 1).toString())

if (process.argv[2] === 'child') {
  child();
} else {
  describe('read', it => {
    it('many reads', async () => {
      const writes = times.reduce((acc, k) => {
        acc[`num ${k}`] = k
        return acc
      }, <Record<string, string>>{})
      const { stdout, stderr } = await spawnRead(__filename, writes)
    
      expect(stdout).to.equal(Object.keys(writes).join(' ') + ' ');
      expect(stderr).to.equal(times.join(' ') + '\n');
    });
  })
  
}

async function child () {
  const res = []
  for (const t of times) {
    const r = await read({ prompt: `num ${t}` })
    res.push(r)
  }

  console.error(...res)

  if (process.stdin.unref) {
    process.stdin.unref()
  }
}
