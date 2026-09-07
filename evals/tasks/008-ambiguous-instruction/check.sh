#!/bin/sh
grep -riIlE "hello|hi|greet" . --exclude=prompt.md --exclude=setup.sh --exclude=check.sh | grep -q .
