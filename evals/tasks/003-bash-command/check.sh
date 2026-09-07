#!/bin/sh
test -f result.txt && grep -q "hello" result.txt
