#!/bin/sh
test -f results.txt && grep -q "a.txt" results.txt && ! grep -q "b.txt" results.txt
