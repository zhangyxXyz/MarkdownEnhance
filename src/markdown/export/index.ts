// Main entry file for export functionality
import * as vscode from 'vscode';
import { isExistsPath, convertMarkdownToHtml, makeHtml, showErrorMessage, checkEnvironment } from './utils';
import { exportHtml } from './exportHtml';
import { exportPdf } from './exportPdf';
import { exportImage } from './exportImage';

// Register export functionality
export function activate(context: vscode.ExtensionContext): void {
  try {
    // Check environment to ensure Chromium or Chrome is installed
    checkEnvironment();
    
    // Register commands
    const disposable_settings = vscode.commands.registerCommand('markdownenhance.export.settings', () => { markdownExport('settings'); });
    const disposable_pdf = vscode.commands.registerCommand('markdownenhance.export.pdf', () => { markdownExport('pdf'); });
    const disposable_html = vscode.commands.registerCommand('markdownenhance.export.html', () => { markdownExport('html'); });
    const disposable_png = vscode.commands.registerCommand('markdownenhance.export.png', () => { markdownExport('png'); });
    const disposable_jpeg = vscode.commands.registerCommand('markdownenhance.export.jpeg', () => { markdownExport('jpeg'); });
    const disposable_all = vscode.commands.registerCommand('markdownenhance.export.all', () => { markdownExport('all'); });

    // Register to context
    context.subscriptions.push(disposable_settings);
    context.subscriptions.push(disposable_pdf);
    context.subscriptions.push(disposable_html);
    context.subscriptions.push(disposable_png);
    context.subscriptions.push(disposable_jpeg);
    context.subscriptions.push(disposable_all);

    // Handle auto-save conversion
    const isConvertOnSave = vscode.workspace.getConfiguration('markdownenhance.export')['convertOnSave'] || false;
    if (isConvertOnSave) {
      const disposable_onsave = vscode.workspace.onDidSaveTextDocument((document) => {
        markdownExportOnSave();
      });
      context.subscriptions.push(disposable_onsave);
    }
  } catch (error) {
    showErrorMessage('activate', error);
  }
}

// Export processing function
async function markdownExport(option_type: string): Promise<void> {
  try {
    // Check active window
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor!');
      return;
    }

    // Check if it's markdown mode
    const mode = editor.document.languageId;
    if (mode !== 'markdown') {
      vscode.window.showWarningMessage('Current mode is not markdown!');
      return;
    }

    const uri = editor.document.uri;
    const mdfilename = uri.fsPath;
    const ext = require('path').extname(mdfilename);
    
    // Check if file exists
    if (!isExistsPath(mdfilename)) {
      if (editor.document.isUntitled) {
        vscode.window.showWarningMessage('Please save the file first!');
        return;
      }
      vscode.window.showWarningMessage('Failed to get filename!');
      return;
    }

    const types_format = ['html', 'pdf', 'png', 'jpeg'];
    let types: string[] = [];

    // Determine export format based on option type
    if (types_format.includes(option_type)) {
      types = [option_type];
    } else if (option_type === 'settings') {
      const types_tmp = vscode.workspace.getConfiguration('markdownenhance.export')['type'] || 'pdf';
      if (types_tmp && !Array.isArray(types_tmp)) {
        types = [types_tmp];
      } else {
        types = vscode.workspace.getConfiguration('markdownenhance.export')['type'] || ['pdf'];
      }
    } else if (option_type === 'all') {
      types = types_format;
    } else {
      showErrorMessage('markdownExport().1 Supported formats: html, pdf, png, jpeg.');
      return;
    }

    // Convert and export markdown to pdf, html, png, jpeg
    if (types && Array.isArray(types) && types.length > 0) {
      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        if (types_format.includes(type)) {
          const filename = mdfilename.replace(ext, '.' + type);
          const text = editor.document.getText();
          // Convert Markdown to HTML
          const content = await convertMarkdownToHtml(mdfilename, type, text);
          // Generate complete HTML
          const html = await makeHtml(content, uri);

          // Export based on type
          if (type === 'html') {
            await exportHtml(html, filename);
          } else if (type === 'pdf') {
            await exportPdf(html, filename, uri);
          } else if (type === 'png' || type === 'jpeg') {
            await exportImage(html, filename, type, uri);
          }
        } else {
          showErrorMessage('markdownExport().2 Supported formats: html, pdf, png, jpeg.');
          return;
        }
      }
    } else {
      showErrorMessage('markdownExport().3 Supported formats: html, pdf, png, jpeg.');
      return;
    }
  } catch (error) {
    showErrorMessage('markdownExport()', error);
  }
}

// Auto-export on save
function markdownExportOnSave(): void {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    
    const mode = editor.document.languageId;
    if (mode !== 'markdown') {
      return;
    }
    
    if (!isMarkdownPdfOnSaveExclude()) {
      markdownExport('settings');
    }
  } catch (error) {
    showErrorMessage('markdownExportOnSave()', error);
  }
}

// Check if auto-save is excluded
function isMarkdownPdfOnSaveExclude(): boolean {
  try {
    const editor = vscode.window.activeTextEditor;
    const filename = editor?.document.fileName;
    if (filename) {
      const excludePattern = vscode.workspace.getConfiguration('markdownenhance.export')['convertOnSaveExclude'] || [];
      const regexp = new RegExp(excludePattern.join('|'));
      return excludePattern.length > 0 && regexp.test(filename);
    }
    return false;
  } catch (error) {
    showErrorMessage('isMarkdownPdfOnSaveExclude()', error);
    return false;
  }
} 