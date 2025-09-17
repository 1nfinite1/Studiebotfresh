/* Targeted CI guard to prevent LLM SDKs/usages from creeping in.
   Rules:
   1) FAIL on restricted imports:
      ^\s*import\s+.+\s+from\s+['"](openai|@ai-sdk\/.*|anthropic|groq-sdk|ollama|aws-sdk\/bedrock)['"];?
   2) FAIL on known LLM-specific hooks/APIs: (ai\/react|useChat|generateText|generateObject)
   3) FAIL on explicit model keys (string literals): model\s*:\s*['"](gpt-|claude-|llama|mistral|mixtral)
   4) /prompts must exist and be EMPTY (no non-hidden files)
   Allowed: the word "prompt" in UI text, comments, and variable names.
*/

const fs = require('fs')
const path = require('path')

const restrictedImport = /^\s*import\s+.+\s+from\s+['"](openai|@ai-sdk\/.*|anthropic|groq-sdk|ollama|aws-sdk\/bedrock)['"];?/m
const llmHooks = /(ai\/react|useChat|generateText|generateObject)/
const modelKeys = /model\s*:\s*['"](gpt-|claude-|llama|mistral|mixtral)/

const allowExt = new Set(['.js', '.jsx', '.ts', '.tsx'])
const SKIP = new Set(['node_modules', 'scripts'])

function shouldScan(file) {
  const ext = path.extname(file)
  if (!allowExt.has(ext)) return false
  const rel = path.relative(process.cwd(), file)
  if ([...SKIP].some((p) => rel === p || rel.startsWith(p + path.sep))) return false
  if (rel === 'eslint.config.js') return false
  return true
}

function isAllowedLLMPath(file) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')
  return rel.startsWith('app/api/llm/') || rel.startsWith('infra/llm/server/')
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

function fail(file, line, snippet, reason) {
  console.error(`Violation in ${file}:${line} — ${reason}`)
  console.error(snippet)
  process.exitCode = 1
}

// 4) Check prompts dir is empty
const promptsDir = path.join(process.cwd(), 'prompts')
if (!fs.existsSync(promptsDir)) {
  console.error('Violation: /prompts folder must exist and be empty')
  process.exit(1)
} else {
  const contents = fs.readdirSync(promptsDir).filter((n) => !n.startsWith('.'))
  if (contents.length > 0) {
    console.error('Violation: /prompts folder must be empty — found:', contents.join(', '))
    process.exit(1)
  }
}

const files = walk(process.cwd())
for (const f of files) {
  if (!shouldScan(f)) continue
  const text = fs.readFileSync(f, 'utf8')
  // remove comments for targeted scans where needed
  const noBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const lines = noBlockComments.split(/\n/)

  // 1) restricted imports
  if (restrictedImport.test(noBlockComments)) {
    const idx = lines.findIndex((l) => restrictedImport.test(l))
    fail(f, idx + 1, lines[idx], 'Restricted LLM import')
  }

  // 2) known LLM hooks/APIs
  if (llmHooks.test(noBlockComments)) {
    const idx = lines.findIndex((l) => llmHooks.test(l))
    fail(f, idx + 1, lines[idx], 'LLM hook/API usage detected')
  }

  // 3) explicit model keys
  if (modelKeys.test(noBlockComments)) {
    const idx = lines.findIndex((l) => modelKeys.test(l))
    fail(f, idx + 1, lines[idx], 'Explicit model key detected')
  }
}

if (process.exitCode === 1) {
  process.exit(1)
} else {
  console.log('LLM scan passed')
}