import path from 'path'
import puppeteer from 'puppeteer'
import { spawn, spawnSync } from 'child_process'

let PROCESS_TIMEOUT = 30000
let TEST_TIMEOUT = 2000
const IS_WINDOWS = process.platform === 'win32'

let serverProc = null
let qunitReporter = null

process.on('SIGTERM', killServerProcess)
process.on('SIGINT', killServerProcess)
process.on('SIGHUP', killServerProcess)

/**
 * Send a log with context to the specified reporter
 * @param {object} context The log message conext - should have source, name, and message
 * @returns {void}
 */
function sendLog(context) {
  if (qunitReporter) {
    qunitReporter.log(context)
  }
}

/**
 * @typedef {object} serverOptions Options for the local, static HTTP server
 * @property {boolean} skipServer If true, this code will not start a local, static HTTP server
 * @property {string} testBaseDir The base directory for the project
 * @property {number} port The port to run the http server on
 */

/**
 * Run one or more target QUnit URLs with tests in a headless browser
 * @param {string[]} targetURLs The URLs to run in the headless browser
 * @param {number} timeout Overall test run timeout (in ms)
 * @param {number} testTimeout Individual test timeout (in ms)
 * @param {serverOptions} serverOptions The options for the static server
 * @returns {Promise<object>} Resolves with the test stats
 */
export async function testRunner(targetURLs, timeout=30000, testTimeout=2000, serverOptions, reporter) {
  PROCESS_TIMEOUT = timeout
  TEST_TIMEOUT = testTimeout

  if (reporter) {
    const missing = ['begin', 'moduleStart', 'moduleDone', 'log', 'testDone', 'done']
      .filter(fn => typeof(reporter[fn]) !== 'function')
    if (missing.length) {
      return Promise.reject(new Error(`Reporter is missing necessary methods: ${missing.join(', ')}`))
    }
    qunitReporter = reporter
  }

  if (!serverOptions.skipServer) {
    serverProc = await startServer(serverOptions.testBaseDir, serverOptions.port)
    if (!serverProc) {
      return Promise.reject(new Error('HTTP server never started.'))
    }

    try {
      
      await wait(() => {
        if (serverProc.ready) { return true }
        if (serverProc.error) { return serverProc.error }
        return false
      }, 10000, 500)

    } catch (err) {
      await killServerProcess()
      let errMessage = err.message || String(err)
      if (/timeout/.test(err)) {
        errMessage = 'HTTP server never started (timeout).'
      } else if (err instanceof Error) {
        const errMatch = errMessage.match(/Error: ([^\n]+)/)
        errMessage = `ERROR on http-server termination: ${(errMatch && errMatch[1]) || errMessage}`
      }
      return Promise.reject(errMessage)
    }
  }

  sendLog({ source: 'console', name: 'info', message: '\nLaunching browser...'})

  const browser = await puppeteer.launch()

  if (!Array.isArray(targetURLs)) {
    targetURLs = [targetURLs]
  }

  const allStats = {}
  for (let url of targetURLs) {
    const page = await setupNewPage(browser)
    await startTests(page, url)
    allStats[url] = page.testStats
  }
  await browser.close()
  await killServerProcess()
  return Promise.resolve(allStats)
}

function startServer(testBaseDir, port) {
  return new Promise((resolve, _) => {
    const server = spawn(
      'node',
      [path.resolve(testBaseDir, 'node_modules', 'http-server', 'bin', 'http-server'), '-c-1', `-p ${port}`, '.'],
      { encoding: 'utf8' }
    )
    
    server.ready = false
    
    server.on('error', async (err) => {
      sendLog({ source: 'console', name: 'error', message: `\nERROR from http-server: ${err.message || err}`})
      await killServerProcess()
    })
    function checkForStart(output) {
      if (/available/i.test(output)) {
        sendLog({ source: 'console', name: 'info', message: `HTTP server up and running on port ${port}`})
        server.ready = true
        server.stdout.off('data', checkForStart)
      }
    }
    server.stdout.on('data', checkForStart)
    server.on('spawn', async () => {
      sendLog({ source: 'console', name: 'log', message: `HTTP server starting...`})
      resolve(server)
    })
  })
}

async function setupNewPage(browser) {
  try {
    const page = await browser.newPage()
    page.testsComplete = false
    if (qunitReporter.reset) {
      qunitReporter.reset()
    }

    // Attach to page's console log events, and log to node console
    page.on('console', (msg) => {
      const text = msg.text()?.trim()
      if (text) {
        sendLog({ source: 'console', name: 'debug', message: text})
      }
    })

    await page.exposeFunction('harness_begin', qunitReporter.begin)
    await page.exposeFunction('harness_moduleStart', qunitReporter.moduleStart)
    await page.exposeFunction('harness_moduleDone', qunitReporter.moduleDone)
    await page.exposeFunction('harness_testDone', qunitReporter.testDone)
    await page.exposeFunction('harness_log', qunitReporter.log)
    await page.exposeFunction('harness_done', context => {
      qunitReporter.done(context)
      page.testStats = context
      page.testsComplete = true
    })

    return page

  } catch (err) {
    sendLog({ source: 'console', name: 'error', message: `\nERROR setting up puppeteer page: ${err.message || err}`})
  }
}

async function startTests(page, targetURL) {
  sendLog({ source: 'console', name: 'log', message: `==> Navigating to ${targetURL}`})

  try {
    await page.goto(targetURL)

    await page.evaluate(`window.QUNIT_PUPPETEER_TEST_TIMEOUT = ${TEST_TIMEOUT}`)
    await page.evaluate(() => {
      QUnit.config.testTimeout = QUNIT_PUPPETEER_TEST_TIMEOUT

      QUnit.begin(window.harness_begin)
      QUnit.moduleStart(window.harness_moduleStart)
      QUnit.moduleDone(window.harness_moduleDone)
      QUnit.testDone(window.harness_testDone)
      QUnit.log(window.harness_log)
      QUnit.done(window.harness_done)

      QUnit.on('error', err => {
        sendLog({ source: 'console', name: 'error', message: `\nQUnit Error: ${err.message || err}`})
      })

      if (!QUnit.config.autostart && !QUnit.config.noHeadlessStart) {
        QUnit.start()
      }
    })

    try {
      
      await wait(() => {
        return page.testsComplete
      }, PROCESS_TIMEOUT)

    } catch (err) {
      await killServerProcess()
      let errMessage = err.message || String(err)
      if (err instanceof Error) {
        const errMatch = errMessage.match(/Error: ([^\n]+)/)
        errMessage = `ERROR waiting for tests to finish: ${(errMatch && errMatch[1]) || errMessage}`
      } else if (/timeout/.test(err) || !page.testsComplete) {
        errMessage = `Test run timed out after ${PROCESS_TIMEOUT}ms`
      }
      return Promise.reject(errMessage)
    }

  } catch (err) {
    sendLog({ source: 'console', name: 'error', message: `\nTest Error: ${err.message || err}`})
    if (!err.stack) {
      Error.captureStackTrace(err)
    }
    sendLog({ source: 'console', name: 'error', message: `${err.stack}\n`})
  }
}

function wait(trigger, timeout=5000, delay) {
  let time = 0
  let delayTime = Number(delay) || 500
  return new Promise((resolve, reject) => {
    const waitHandler = setInterval(() => {
      time += delayTime
      const triggerResult = trigger()
      if (triggerResult === true) {
        clearInterval(waitHandler)
        return resolve()
      } else if (triggerResult instanceof Error) {
        clearInterval(waitHandler)
        return reject(triggerResult)
      } else if (time >= timeout) {
        clearInterval(waitHandler)
        return reject(new Error(`Wait timer timed out after ${timeout}ms`))
      }
    }, delayTime)
  })
}

async function killServerProcess() {
  if (IS_WINDOWS && serverProc && !serverProc.killed) {
    sendLog({ source: 'console', name: 'debug', message: `Killing http-server process`})
    if (!serverProc?.kill()) {
      sendLog({
        source: 'console',
        name: 'warn',
        message: `Problem killing server process! (${serverProc ? '(false result)' : 'No serverProc exists'})`
      })
    }
  } else if (serverProc && serverProc.pid && !serverProc.killed) {
    sendLog({ source: 'console', name: 'debug', message: `Killing http-server process`})
    spawnSync('kill', [serverProc.pid])
  }
}
