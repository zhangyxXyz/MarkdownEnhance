import * as vscode from 'vscode';
import * as path from 'path';
import { isExistsPath, deleteFile, getOutputDir, transformTemplate, showErrorMessage } from './utils';
import { exportHtml } from './exportHtml';

/**
 * Export HTML to PDF file
 */
export async function exportPdf(data: string, filename: string, uri: vscode.Uri): Promise<void> {
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
        title: '[Markdown PDF]: Exporting (pdf) ...'
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

            // Process anti-formula-break settings if enabled
            const preventFormulaBreak = vscode.workspace.getConfiguration('markdownenhance.export', uri)['preventFormulaBreak'] !== false;
            const renderTimeout = vscode.workspace.getConfiguration('markdownenhance.export', uri)['renderTimeout'] || 1000;

            if (preventFormulaBreak) {
                // Wait for all math elements to render properly
                await page.evaluate((timeout: number) => {
                    return new Promise<void>((resolve) => {
                        // Give extra time for KaTeX/MathJax rendering to complete
                        setTimeout(() => {
                            // Ensure all math formulas are properly rendered
                            const mathElements = Array.from(document.querySelectorAll('.katex-display, .katex, .math, span.math, div.math'));
                            if (mathElements.length > 0) {
                                console.log(`Found ${mathElements.length} math elements, applying anti-break protection`);
                                // Add extra page break protection for each formula element
                                mathElements.forEach((el) => {
                                    // Ensure element has explicit display property
                                    (el as HTMLElement).style.display = (el as HTMLElement).style.display || 'block';

                                    // Add new outer wrapper container for formula with additional pagination control
                                    if (!el.parentElement?.classList.contains('math-wrapper')) {
                                        const wrapper = document.createElement('div');
                                        wrapper.className = 'math-wrapper';
                                        wrapper.style.pageBreakInside = 'avoid';
                                        wrapper.style.breakInside = 'avoid';
                                        wrapper.style.margin = '1em 0';
                                        el.parentNode?.insertBefore(wrapper, el);
                                        wrapper.appendChild(el);
                                    }
                                });

                                // Try to find all KaTeX HTML output elements
                                const katexHTMLElements = document.querySelectorAll('span.katex-html');
                                console.log(`Found ${katexHTMLElements.length} KaTeX HTML elements`);
                                katexHTMLElements.forEach((el) => {
                                    (el as HTMLElement).style.pageBreakInside = 'avoid';
                                    (el as HTMLElement).style.breakInside = 'avoid';
                                });
                            }
                            resolve();
                        }, timeout);
                    });
                }, renderTimeout);
                await new Promise<void>(resolve => setTimeout(resolve, 200));
            }

            // Configure PDF export options
            const width_option = vscode.workspace.getConfiguration('markdownenhance.export', uri)['width'] || '';
            const height_option = vscode.workspace.getConfiguration('markdownenhance.export', uri)['height'] || '';
            let format_option = '';
            if (!width_option && !height_option) {
                format_option = vscode.workspace.getConfiguration('markdownenhance.export', uri)['format'] || 'A4';
            }

            // Set page orientation
            let landscape_option = false;
            if (vscode.workspace.getConfiguration('markdownenhance.export', uri)['orientation'] === 'landscape') {
                landscape_option = true;
            }

            // Configure PDF export options
            const pdfOptions = {
                path: exportFilename,
                scale: vscode.workspace.getConfiguration('markdownenhance.export', uri)['scale'],
                displayHeaderFooter: vscode.workspace.getConfiguration('markdownenhance.export', uri)['displayHeaderFooter'],
                headerTemplate: transformTemplate(vscode.workspace.getConfiguration('markdownenhance.export', uri)['headerTemplate'] || ''),
                footerTemplate: transformTemplate(vscode.workspace.getConfiguration('markdownenhance.export', uri)['footerTemplate'] || ''),
                printBackground: vscode.workspace.getConfiguration('markdownenhance.export', uri)['printBackground'],
                landscape: landscape_option,
                pageRanges: vscode.workspace.getConfiguration('markdownenhance.export', uri)['pageRanges'] || '',
                format: format_option,
                width: vscode.workspace.getConfiguration('markdownenhance.export', uri)['width'] || '',
                height: vscode.workspace.getConfiguration('markdownenhance.export', uri)['height'] || '',
                margin: {
                    top: vscode.workspace.getConfiguration('markdownenhance.export', uri)['margin']['top'] || '',
                    right: vscode.workspace.getConfiguration('markdownenhance.export', uri)['margin']['right'] || '',
                    bottom: vscode.workspace.getConfiguration('markdownenhance.export', uri)['margin']['bottom'] || '',
                    left: vscode.workspace.getConfiguration('markdownenhance.export', uri)['margin']['left'] || ''
                },
                timeout: 0
            };

            // Generate PDF file
            await page.pdf(pdfOptions);

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
            showErrorMessage('exportPdf()', error);
        }
    });
}
