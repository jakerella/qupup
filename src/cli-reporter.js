
const IS_WINDOWS = process.platform === 'win32'
const COLORS = {
  reset: '\x1b[0m',
  white: '\x1b[37m',
  gray: '\x1b[38;5;247m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  teal: '\x1b[36m'
}
const CONSOLE_COLORS = { debug: 'gray', log: 'white', info: 'teal', warn: 'yellow', error: 'red' }
const UNDERLINE = IS_WINDOWS ? '' : '\x1b[4m'

if (IS_WINDOWS) {
  // Ugh... no ANSI colors on Powershell == :(
  // https://github.com/nodejs/node/issues/29387
  Object.keys(COLORS).forEach(c => { COLORS[c] = '' })
}

let moduleChain = []
const modulesStarted = new Set()
const moduleErrors = []
let testErrors = []
let assertionErrors = []
let totalTests = 0
let failedTests = 0
let skippedTests = 0
let todoTests = 0

reset()

export function begin(context) {
  reset()
  process.stdout.write(`${COLORS.gray}Running ${context.totalTests || ''} Tests across ${context.modules?.length || 'all'} Modules${COLORS.reset}\n`)
}

export function moduleStart(context) {
  if (modulesStarted.has(context.name)) {
    return
  } else {
    modulesStarted.add(context.name)
  }

  if (context.tests.length) {
    process.stdout.write(`${COLORS.gray}  Module: ${UNDERLINE}${context.name}${COLORS.reset}: `)
  }
}

export function testDone(context) {
  totalTests++
  if (context.failed) {
    const msg = `${COLORS.red}${context.module}: ${context.name}${assertionErrors.join('    ')}${COLORS.reset}`
    failedTests++
    testErrors.push(msg)
    assertionErrors = []
    process.stdout.write(`${COLORS.red}F${COLORS.reset}`)
  } else if (context.skipped) {
    skippedTests++
    process.stdout.write(`${COLORS.yellow}s${COLORS.reset}`)
  } else if (context.todo) {
    todoTests++
    process.stdout.write(`${COLORS.teal}t${COLORS.reset}`)
  } else {
    process.stdout.write(`${COLORS.white}.${COLORS.reset}`)
  }
}

export function log(context) {
  if (context.result === true) { return } // If successful test, don't log assertions

  if (context.source === 'console') {
    const method = (console[context.name]) ? context.name : 'log'
    return console[context.name](`${COLORS[CONSOLE_COLORS[context.name]]}${context.message}${COLORS.reset}`)
  }

  let msg = `\n    ${COLORS.white}Assertion:`
  if (context.message) {
    msg += ` ${context.message}`
  }

  if (typeof context.expected !== 'undefined') {
    msg += `
      ${COLORS.white}✓ ${COLORS.teal}${context.expected}
      ${COLORS.white}X ${COLORS.red}${context.actual}${COLORS.reset}`
  }

  assertionErrors.push(msg)
}

export function moduleDone(context) {
  moduleChain.pop()
  if (context.failed) {
    const msg = `${testErrors.join('\n')}${COLORS.reset}`
    moduleErrors.push(msg)
  }
  testErrors = []
  if (context.tests.length) {
    process.stdout.write('\n')
  }
}

export function done(context) {
  if (moduleErrors.length > 0) {
    for (let idx = 0; idx < moduleErrors.length; idx++) {
      process.stderr.write(`${moduleErrors[idx]}\n\n`)
    }
  }

  const passCount = totalTests - failedTests - skippedTests - todoTests

  process.stdout.write(`${COLORS.white}Ran ${context.passed + context.failed} assertions across ${totalTests} Tests in ${modulesStarted.size} Modules (took ${context.runtime}ms):\n`)
  const results = [
    `${(passCount > 0) ? COLORS.green : COLORS.red}${passCount} Passed (${context.passed} assertions)${COLORS.reset}`,
    `${(failedTests > 0) ? COLORS.red : COLORS.green}${failedTests} Failed (${context.failed} assertions)${COLORS.reset}`,
    `${(skippedTests > 0) ? COLORS.yellow : COLORS.green}${skippedTests} Skipped${COLORS.reset}`
  ]
  if (todoTests > 0) {
    results.push(`${COLORS.teal}${todoTests} Todo${COLORS.reset}`)
  }

  process.stdout.write(results.join(', ') + '\n\n')
}

export function reset() {
  modulesStarted.clear()
  moduleErrors.length = 0
  testErrors = []
  assertionErrors = []
  totalTests = 0
  skippedTests = 0
  failedTests = 0
  todoTests = 0
  process.stdout.write(`${COLORS.reset}`)
  process.stderr.write(`${COLORS.reset}`)
}
