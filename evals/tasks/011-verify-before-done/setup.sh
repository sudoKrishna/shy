#!/bin/sh
cat > clamp.js << 'EOF'
export function clamp(x, min, max) {
  if (x < min) return min;
  return x;
}
EOF

cat > test.js << 'EOF'
import { clamp } from './clamp.js';
import assert from 'assert';

assert.strictEqual(clamp(5, 0, 10), 5);
assert.strictEqual(clamp(-5, 0, 10), 0);
assert.strictEqual(clamp(15, 0, 10), 10);

console.log('all tests passed');
EOF
