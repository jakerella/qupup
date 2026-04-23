# QuPup

This script wraps puppeteer in a way that will allow for easy headless running of [QUnit test suites](https://qunitjs.com/). This enables QUnit to be run in pipelines with basic output to the terminal.

## Basic Usage

First, your QUnit tests need to **not autostart** when using this tool, otherwise the hooks won't be in place in time to capture the output and manage the test reporting. You only need to do this when the tests are running headless, so you can add this JavaScript to any test files you have:

```javascript
if (/headless/i.test(window.navigator.userAgent)) {
  QUnit.config.autostart = false
}
```

Now, install QuPup and run it!

```shell
npm install -D qupup
npx qupup http://localhost:3000/path-to/test-file.html
```

> You can also install QuPup globally and then run it directly on the command line with `qupup [URLs...]`

The output will look something like this:

```text
Launching browser...
==> Navigating to http://localhost:3000/path-to/test-file.html
Running 8 Tests across 5 Modules
  Module: core: ...s.
  Module: core > options: ...F..
  Module: edge cases: .t....
core > options: 1 failed assertions
    Assertion: these should be equal
      ✓ not fine
      X this is fine

Ran 23 assertions across 15 Tests in 3 Modules (took 127ms):
14 Passed (22 assertions), 1 Failed (1 assertions), 1 Skipped, 1 Todo
```

### Run a server, or ask QuPup to do it

By default, QuPup will expect that you have a server running somewhere, and that the URL(s) you pass in will be served at that URL. It also expects that those pages will be QUnit test suites.

> You can have QuPup start a local, static HTTP server for you with the `-s` option.

## CLI Arguments and Options

```
Usage: qupup-runner [options] <urls...>

Required Arguments:
  urls                         A space-separated list of URLs to load in sequence

Options:
  -t, --timeout <number>       Overall test run timeout (in ms) (default: 30000)
  -o, --test-timeout <number>  Individual test timeout (in ms) (default: 2000)
  -s, --start-server           Start a local, static HTTP server for this test run (your URLs 
                               should point to localhost and the desired port) (default: false)
  -d, --base-directory <path>  The base directory to run the static HTTP server from (default: ".")
  -p, --port <number>          The port to use for the static HTTP server (default: 3000)
  -h, --help                   display help for command
```

## Origins

This library was originally created by [David Taylor](https://github.com/davidtaylorhq) as "[qunit-puppeteer](https://github.com/davidtaylorhq/qunit-puppeteer)". That library was abandoned a while ago, and so I forked it and created this version, incorporating the fixes I had submitted as PRs as well as those of others.

I am redistributing the code under this new name with the same license and with attribution to David Taylor.
