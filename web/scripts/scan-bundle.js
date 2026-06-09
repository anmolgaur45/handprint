/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const BANNED_PATTERNS = [
  {
    name: 'Private Key Header',
    regex: /-----BEGIN[A-Z0-9\s_]+PRIVATE KEY-----/i
  },
  {
    name: 'Firebase Service Account Reference',
    regex: /"type":\s*"service_account"|adminsdk/i
  },
  {
    name: 'Private Key ID JSON Field',
    regex: /"private_key_id":/i
  }
];

function scanDirectory(dir) {
  let hasLeak = false;
  if (!fs.existsSync(dir)) {
    return false;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file === 'cache' || file === 'node_modules') continue;
      if (scanDirectory(fullPath)) {
        hasLeak = true;
      }
    } else {
      const ext = path.extname(file);
      if (['.js', '.html', '.json', '.txt'].includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of BANNED_PATTERNS) {
          if (pattern.regex.test(content)) {
            console.error(`\x1b[31m[LEAK DETECTED]\x1b[0m File: ${fullPath} contains pattern matching "${pattern.name}"`);
            hasLeak = true;
          }
        }
      }
    }
  }
  return hasLeak;
}

const buildDir = path.join(__dirname, '../.next');
console.log(`Scanning client bundle in: ${buildDir}`);
const leaked = scanDirectory(buildDir);

if (leaked) {
  console.error('\x1b[31m[FAILED] Client bundle scan failed. Banned secret detected in build output.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m[PASSED] Client bundle scan passed. No secrets detected.\x1b[0m');
  process.exit(0);
}
