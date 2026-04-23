#! /usr/bin/env node

import { program } from 'commander'
import { resolve } from 'path'
import { testRunner } from '../src/qupup.js'
import * as cliReporter from '../src/cli-reporter.js'

program
  .description('Run a QUnit test suite in a headless browser')
  .argument('urls...', 'A space-separated list of URLs to load in sequence')
  .option('-t, --timeout <number>', 'Overall test run timeout (in ms)', Number, 30000)
  .option('-o, --test-timeout <number>', 'Individual test timeout (in ms)', Number, 2000)
  .option('-s, --start-server', 'Start a local, static HTTP server for this test run (your URLs should point to localhost and the desired port)', false)
  .option('-d, --base-directory <path>', 'The base directory to run the static HTTP server from', '.')
  .option('-p, --port <number>', 'The port to use for the static HTTP server', Number, 3000)
  .action(async (urls, options) => {
    const baseDir = options.baseDirectory ? resolve(options.baseDirectory) : import.meta.dirname
    
    try {
      await testRunner(
        urls,
        options.timeout,
        options.testTimeout,
        {
          startServer: options.startServer,
          testBaseDir: baseDir,
          port: options.port
        },
        cliReporter
      )
      process.exit(0)
      
    } catch(err) {
      console.error('\nERROR:\n', err)
      process.exit(1)
    }
  })

program.parse()
