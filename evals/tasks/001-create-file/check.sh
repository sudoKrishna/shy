#!/bin/sh
test -f hello.txt && grep -q "hello world" hello.txt
