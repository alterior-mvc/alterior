const spawn = require('child_process').spawn
const esc = (str: string) => str
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')

export async function spawnRead(filename: string, writes: Record<string, string>) {
  const proc = spawn(process.execPath, [filename, 'child'])

  return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (c: string) => {
      stdout += c
      for (const [prompt, write] of Object.entries(writes)) {
        if (stdout.match(new RegExp(`${esc(prompt)} $`))) {
          return process.nextTick(() => proc.stdin.write(`${write}\n`))
        }
      }
      reject(new Error(`unknown prompt:\n${stdout}\n${JSON.stringify(writes)}`))
    })

    proc.stderr.on('data', (c: string) => {
      stderr += c
    })

    proc.on('close', () => resolve({
      stdout,
      stderr,
    }))
  })
}
