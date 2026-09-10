#!/bin/sh
cat > utils.js << 'EOF'
export function calculateTotal(a, b) {
  return a + b;
}
EOF

cat > main.js << 'EOF'
import { calculateTotal } from './utils.js';

console.log(calculateTotal(2, 3));
EOF
