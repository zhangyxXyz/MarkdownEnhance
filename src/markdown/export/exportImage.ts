import * as vscode from 'vscode';
import * as path from 'path';
import { isExistsPath, deleteFile, getOutputDir, showErrorMessage } from './utils';
import { exportHtml } from './exportHtml';

/**
 * Export HTML to image file (PNG, JPEG)
 */
export async function exportImage(data: string, filename: string, type: string, uri: vscode.Uri): Promise<void> {
    // Check if Chrome or Chromium is installed
    if (!require('./utils').isInstalled()) {
        showErrorMessage('Chromium or Chrome does not exist! Please refer to the README document for details');
        return;
    }

    const statusbarMessageTimeout = vscode.workspace.getConfiguration('markdownenhance.export')['StatusbarMessageTimeout'];
    vscode.window.setStatusBarMessage('');
    const exportFilename = getOutputDir(filename, uri);

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '[Markdown PDF]: Exporting (' + type + ') ...'
    }, async () => {
        try {
            // Load puppeteer-core
            const puppeteer = require('puppeteer-core');
            // Create temporary file
            const fileInfo = path.parse(filename);
            const tmpfilename = path.join(fileInfo.dir, fileInfo.name + '_tmp.html');
            // Export temporary HTML file
            await exportHtml(data, tmpfilename);

            // Configure Puppeteer options
            const options = {
                executablePath: vscode.workspace.getConfiguration('markdownenhance.export')['executablePath'] || puppeteer.executablePath(),
                args: ['--lang=' + vscode.env.language, '--no-sandbox', '--disable-setuid-sandbox']
            };

            // Launch browser and open temporary HTML
            const browser = await puppeteer.launch(options);
            const page = await browser.newPage();
            await page.setDefaultTimeout(0);
            await page.goto(vscode.Uri.file(tmpfilename).toString(), { waitUntil: 'networkidle0' });

            // Configure image export options
            // Quality options do not apply to PNG images
            let quality_option;
            if (type === 'png') {
                quality_option = undefined;
            } else if (type === 'jpeg') {
                quality_option = vscode.workspace.getConfiguration('markdownenhance.export')['quality'] || 100;
            }

            // Configure clipping options if specified
            const clip_x_option = vscode.workspace.getConfiguration('markdownenhance.export')['clip']['x'] || null;
            const clip_y_option = vscode.workspace.getConfiguration('markdownenhance.export')['clip']['y'] || null;
            const clip_width_option = vscode.workspace.getConfiguration('markdownenhance.export')['clip']['width'] || null;
            const clip_height_option = vscode.workspace.getConfiguration('markdownenhance.export')['clip']['height'] || null;

            // Generate screenshot options
            let screenshotOptions;
            if (clip_x_option !== null && clip_y_option !== null && clip_width_option !== null && clip_height_option !== null) {
                // Use specified clip area
                screenshotOptions = {
                    path: exportFilename,
                    type: type,
                    quality: quality_option,
                    fullPage: false,
                    clip: {
                        x: clip_x_option,
                        y: clip_y_option,
                        width: clip_width_option,
                        height: clip_height_option
                    },
                    omitBackground: vscode.workspace.getConfiguration('markdownenhance.export')['omitBackground'],
                };
            } else {
                // Remove excess whitespace: get actual content dimensions
                const contentSize = await page.evaluate(() => {
                    // This code runs in the browser, so we can use document
                    // Get all elements in the document
                    const elements = document.querySelectorAll('body *');
                    let maxHeight = 0;
                    let maxWidth = 0;

                    // Calculate the maximum height and width from all elements
                    elements.forEach((el: Element) => {
                        const rect = el.getBoundingClientRect();
                        const bottom = rect.top + rect.height;
                        if (bottom > maxHeight) {
                            maxHeight = bottom;
                        }

                        const right = rect.left + rect.width;
                        if (right > maxWidth) {
                            maxWidth = right;
                        }
                    });

                    // Ensure minimum width and height (page content might be sparse)
                    maxWidth = Math.max(maxWidth, document.body.clientWidth);
                    maxHeight = Math.max(maxHeight, document.body.clientHeight);

                    // Add some bottom padding (optional, prevents content from being too close to bottom)
                    maxHeight += 40;

                    // Ensure returned values are integers
                    return {
                        width: Math.ceil(maxWidth),
                        height: Math.ceil(maxHeight)
                    };
                });

                // Set viewport size to actual content dimensions
                await page.setViewport({
                    width: Math.ceil(contentSize.width),
                    height: Math.ceil(contentSize.height),
                    deviceScaleFactor: 1,
                });

                screenshotOptions = {
                    path: exportFilename,
                    type: type,
                    quality: quality_option,
                    fullPage: false,  // Don't use full page mode, use custom dimensions instead
                    omitBackground: vscode.workspace.getConfiguration('markdownenhance.export')['omitBackground'],
                };
            }

            // Take screenshot
            await page.screenshot(screenshotOptions);

            // Close browser
            await browser.close();

            // Delete temporary file
            const debug = vscode.workspace.getConfiguration('markdownenhance.export')['debug'] || false;
            if (!debug) {
                if (isExistsPath(tmpfilename)) {
                    deleteFile(tmpfilename);
                }
            }

            // Show success message
            vscode.window.setStatusBarMessage('$(markdown) ' + exportFilename, statusbarMessageTimeout);
        } catch (error) {
            showErrorMessage('exportImage()', error);
        }
    });
}
