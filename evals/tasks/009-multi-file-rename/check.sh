#!/bin/sh
! grep -rq "calculateTotal" utils.js main.js && \
grep -q "computeTotal" utils.js && \
grep -q "computeTotal" main.js && \
node main.js | grep -q "^5$"
