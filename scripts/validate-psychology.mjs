#!/usr/bin/env node
/**
 * Validates all psychological layer JSON files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const PSYCHOLOGY_FILES = [
  'psychology/emotional_tags.json',
  'psychology/attachments.json',
  'psychology/trust_map.json',
  'psychology/psyeval.json',
  'identity/goals.json',
  'identity/feared_self.json',
  'identity/possible_selves.json',
  'transformation/current_state.json',
  'transformation/history.json',
  'purpose/ikigai.json',
  'purpose/meaning_sources.json',
  'purpose/wellness.json',
];

const REQUIRED_FILES = [
  'soul/HELIX_SOUL.md',
  'USER.md',
];

let valid = 0;
let invalid = 0;
const errors = [];

console.log('Validating Helix Psychological Architecture...\n');

// Validate JSON files
for (const file of PSYCHOLOGY_FILES) {
  const filePath = path.join(rootDir, file);
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    console.log(`✓ ${file}`);
    valid++;
  } catch (e) {
    console.log(`✗ ${file} - ${e.message}`);
    errors.push({ file, error: e.message });
    invalid++;
  }
}

// Validate required files
console.log('\nRequired Files:');
for (const file of REQUIRED_FILES) {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file}`);
    valid++;
  } else {
    console.log(`✗ ${file} - File not found`);
    errors.push({ file, error: 'File not found' });
    invalid++;
  }
}

console.log(`\n${valid}/${valid + invalid} files valid`);

if (invalid > 0) {
  console.log('\nErrors:');
  for (const { file, error } of errors) {
    console.log(`  - ${file}: ${error}`);
  }
  process.exit(1);
}

console.log('\n✓ All psychological layers valid');
process.exit(0);
