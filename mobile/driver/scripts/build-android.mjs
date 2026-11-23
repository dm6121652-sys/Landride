import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const easCli = path.join(projectDirectory, 'node_modules', 'eas-cli', 'bin', 'run')
const result = spawnSync(process.execPath, [easCli, 'build', '--platform', 'android', '--profile', 'preview'], {
  cwd: projectDirectory,
  env: { ...process.env, EAS_NO_VCS: '1', EAS_PROJECT_ROOT: projectDirectory },
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
