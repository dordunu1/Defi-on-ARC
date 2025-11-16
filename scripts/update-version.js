#!/usr/bin/env node

/**
 * Script to update app version in both version.ts and version.json
 * Usage: node scripts/update-version.js [version]
 * Example: node scripts/update-version.js 2.3.0
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Get version from command line or use current timestamp as fallback
const newVersion = process.argv[2] || `2.${Date.now()}`;
const buildTime = new Date().toISOString();

// Update version.ts
const versionTsPath = join(rootDir, 'src', 'config', 'version.ts');
const versionTsContent = `// App version - update this when releasing a new version
export const APP_VERSION = '${newVersion}';
export const BUILD_TIME = '${buildTime}';
`;
writeFileSync(versionTsPath, versionTsContent, 'utf-8');
console.log(`✅ Updated ${versionTsPath} to version ${newVersion}`);

// Update version.json
const versionJsonPath = join(rootDir, 'public', 'version.json');
const versionJsonContent = JSON.stringify({
  version: newVersion,
  buildTime: buildTime,
}, null, 2);
writeFileSync(versionJsonPath, versionJsonContent, 'utf-8');
console.log(`✅ Updated ${versionJsonPath} to version ${newVersion}`);

console.log(`\n🎉 Version updated to ${newVersion}`);
console.log(`📦 Build time: ${buildTime}`);

