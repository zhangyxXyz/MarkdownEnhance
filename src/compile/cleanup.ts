#!/usr/bin/env node
/**
 * Pre-packaging cleanup script
 * Removes unnecessary files and paths to reduce final package size
 */

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// Use require for modules without type definitions
const rimraf = require('rimraf');
const removeNPMAbsolutePaths = require('removeNPMAbsolutePaths');

// Create promise version of rimraf function
const rimrafPromise = util.promisify(rimraf);

// Define error type interface
interface ErrorWithMessage {
  message: string;
}

// Define result type interface
interface RemovePathResult {
  success: boolean;
  err?: ErrorWithMessage;
}

/**
 * Delete specified directory
 * @param dir Path of directory to delete
 */
async function deleteFile(dir: string): Promise<void> {
  try {
    await rimrafPromise(dir);
    console.log(`Successfully deleted: ${dir}`);
  } catch (err: unknown) {
    const error = err as ErrorWithMessage;
    console.error(`Failed to delete ${dir}: ${error.message}`);
    throw err;
  }
}

/**
 * Main function
 */
async function cleanup(): Promise<void> {
  // Get project root directory path
  const rootDir = path.resolve(__dirname, '..', '..');
  
  console.log('Starting to delete unnecessary files...');
  console.log(`Working in directory: ${rootDir}`);
  
  try {
    // Delete json directory in emoji-images
    const emojiJsonPath = path.join(rootDir, 'node_modules', 'emoji-images', 'json');
    if (fs.existsSync(emojiJsonPath)) {
      console.log(`Found emoji-images/json at: ${emojiJsonPath}`);
      await deleteFile(emojiJsonPath);
    } else {
      console.log(`Directory not found: ${emojiJsonPath}, skipping...`);
    }
    
    // Delete .local-chromium directory in puppeteer-core
    const chromiumPath = path.join(rootDir, 'node_modules', 'puppeteer-core', '.local-chromium');
    if (fs.existsSync(chromiumPath)) {
      console.log(`Found puppeteer-core/.local-chromium at: ${chromiumPath}`);
      await deleteFile(chromiumPath);
    } else {
      console.log(`Directory not found: ${chromiumPath}, skipping...`);
    }
    
    // Remove absolute paths in node_modules
    const nodeModulesPath = path.join(rootDir, 'node_modules');
    console.log(`Node modules path: ${nodeModulesPath}`);
    
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(`Warning: node_modules directory not found at ${nodeModulesPath}`);
      console.log('Cleanup completed!');
      return;
    }
    
    console.log('Removing NPM absolute paths...');
    const results = await removeNPMAbsolutePaths(nodeModulesPath, { 
      force: true, 
      fields: ['_where', '_args'] 
    }) as RemovePathResult[];
    
    // Print information about files that couldn't be processed
    let errorCount = 0;
    results.forEach((result: RemovePathResult) => {
      if (!result.success && result.err) {
        errorCount++;
        console.log(`Path removal failed: ${result.err.message}`);
      }
    });
    
    if (errorCount > 0) {
      console.log(`Encountered ${errorCount} errors while removing paths, but process completed.`);
    } else {
      console.log(`Successfully removed absolute paths from package files.`);
    }
    
    console.log('Cleanup completed!');
  } catch (err: unknown) {
    const error = err as ErrorWithMessage;
    console.error(`Error during cleanup process: ${error.message}`);
    process.exit(1);
  }
}

// Execute cleanup
cleanup(); 