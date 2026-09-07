#!/bin/sh
test -f count.txt && grep -q "^3$" count.txt
