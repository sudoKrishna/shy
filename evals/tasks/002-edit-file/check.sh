#!/bin/sh
grep -q "hello there" greet.txt && ! grep -q "^hi " greet.txt
