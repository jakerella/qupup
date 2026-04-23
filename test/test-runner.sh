#! /usr/bin/bash

echo "****** TEST WITH ONE PAGE AND LOCAL SERVER STARUP ******"
node bin/qupup-runner.js http://localhost:3000/test/basic.html -s

echo ""
echo "****** TEST WITH MULTIPLE PAGES AND LOCAL SERVER STARUP ******"
node bin/qupup-runner.js http://localhost:3000/test/simple.html http://localhost:3000/test/simple-two.html -s

echo ""
echo "****** TEST WITH DIFFERENT BASEDIR ******"
node bin/qupup-runner.js http://localhost:3000/sub-dir.html -s -d ./test

echo ""
echo "****** TEST WITH DIFFERENT PORT ******"
node bin/qupup-runner.js http://localhost:8080/test/simple.html -s -p 8080

echo ""
echo "****** TEST WITH ONE PAGE AND _NO_ LOCAL SERVER STARUP ******"
./node_modules/http-server/bin/http-server -c-1 -p 8888 . &
serverpid=$!
node bin/qupup-runner.js http://localhost:8888/test/simple.html
kill $serverpid

echo ""
echo "****** TEST WITH NON-QUNIT PAGE ******"
node bin/qupup-runner.js http://localhost:3000/test/no-qunit.html -s
