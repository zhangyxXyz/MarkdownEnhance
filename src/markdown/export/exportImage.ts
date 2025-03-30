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
        // 使用指定的裁剪区域
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
        // 消除多余空白：获取实际内容的尺寸
        const contentSize = await page.evaluate(() => {
          // 这段代码在浏览器中执行，所以可以使用 document
          // 获取文档中所有元素
          const elements = document.querySelectorAll('body *');
          let maxHeight = 0;
          let maxWidth = 0;
          
          // 计算所有元素中的最大高度和宽度
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
          
          // 确保至少有最小宽度和高度（页面内容可能很少）
          maxWidth = Math.max(maxWidth, document.body.clientWidth);
          maxHeight = Math.max(maxHeight, document.body.clientHeight);
          
          // 添加一些底部填充（可选，防止内容过于贴近底部）
          maxHeight += 40;
          
          // 确保返回的是整数值
          return { 
            width: Math.ceil(maxWidth), 
            height: Math.ceil(maxHeight) 
          };
        });
        
        // 使用实际内容尺寸设置视口大小
        await page.setViewport({
          width: Math.ceil(contentSize.width),
          height: Math.ceil(contentSize.height),
          deviceScaleFactor: 1,
        });
        
        screenshotOptions = {
          path: exportFilename,
          type: type,
          quality: quality_option,
          fullPage: false,  // 不再使用全页模式，使用自定义尺寸
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