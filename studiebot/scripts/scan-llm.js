/* CI guard: fail build if prohibited LLM SDKs or prompt strings appear outside comments */
const fs = require('fs')
const path = require('path')

const forbid = /(openai|anthropic|groq|ollama|bedrock|gpt|prompt)/i
const allowExt = new Set(['.js', '.jsx', '.ts', '.tsx'])

function shouldScan(file) {
  const ext = path.extname(file)
  if (!allowExt.has(ext)) return false
  const rel = file.replace(process.cwd()+path.sep,'')
  if (rel.startsWith('node_modules')) return false
  if (rel.startsWith('scripts')) return false // skip scripts folder
  if (rel === 'scripts/scan-llm.js') return false // skip the scanner itself
  return true
}

function walk(dir) {
  let files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) files = files.concat(walk(p))
    else files.push(p)
  }
  return files
}

const files = walk(process.cwd())
let violations = []
for (const f of files) {
  if (!shouldScan(f)) continue
  const text = fs.readFileSync(f, 'utf8')
  // Remove comments before scanning
  const noComments = text
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|\s)\/\/.*$/gm, '') // line comments
  if (forbid.test(noComments)) {
    violations.push(f)
  }
}

if (violations.length) {
  console.error('Forbidden LLM references found in files:')
  for (const v of violations) console.error(' -', v)
  process.exit(1)
} else {
  console.log('LLM scan passed')
}