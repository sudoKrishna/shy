#!/bin/sh
cat > math.js << 'EOF'
export function add(a, b) {
  return a - b;
}
EOF

cat > decoy.js << 'EOF'
export function multiply(a, b) {
  return a * b;
}
EOF

cat > test.js << 'EOF'
import { add } from './math.js';
import assert from 'assert';

assert.strictEqual(add(2, 3), 5);

console.log('all tests passed');
EOF
