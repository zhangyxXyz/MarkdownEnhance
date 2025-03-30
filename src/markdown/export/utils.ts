import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as url from 'url';

// Installation check status
let INSTALL_CHECK = false;

/**
 * Show error message
 */
export function showErrorMessage(msg: string, error?: any): void {
    vscode.window.showErrorMessage('Error: ' + msg);
    console.log('Error: ' + msg);
    if (error) {
        vscode.window.showErrorMessage(error.toString());
        console.log(error);
    }
}

/**
 * Check if path exists
 */
export function isExistsPath(path: string): boolean {
    if (path.length === 0) {
        return false;
    }
    try {
        fs.accessSync(path);
        return true;
    } catch (error) {
        console.warn((error as Error).message);
        return false;
    }
}

/**
 * Check if directory exists
 */
export function isExistsDir(dirname: string): boolean {
    if (dirname.length === 0) {
        return false;
    }
    try {
        if (fs.statSync(dirname).isDirectory()) {
            return true;
        } else {
            console.warn('Directory does not exist!');
            return false;
        }
    } catch (error) {
        console.warn((error as Error).message);
        return false;
    }
}

/**
 * Delete file
 */
export function deleteFile(path: string): void {
    const rimraf = require('rimraf');
    rimraf.sync(path);
}

/**
 * Get output directory
 */
export function getOutputDir(filename: string, resource?: vscode.Uri): string {
    try {
        if (resource === undefined) {
            return filename;
        }
        const outputDirectory = vscode.workspace.getConfiguration('markdownenhance.export')['outputDirectory'] || '';
        if (outputDirectory.length === 0) {
            return filename;
        }

        // If it starts with ~, use path relative to home directory
        if (outputDirectory.indexOf('~') === 0) {
            const outputDir = outputDirectory.replace(/^~/, os.homedir());
            mkdir(outputDir);
            return path.join(outputDir, path.basename(filename));
        }

        // If it's an absolute path, use it directly
        if (path.isAbsolute(outputDirectory)) {
            if (!isExistsDir(outputDirectory)) {
                showErrorMessage(`The output directory specified by markdownenhance.export.outputDirectory option does not exist. Please check the markdownenhance.export.outputDirectory option. ${outputDirectory}`);
                return '';
            }
            return path.join(outputDirectory, path.basename(filename));
        }

        // If markdownenhance.export.outputDirectoryRootPath = workspace and workspace exists, use path relative to workspace
        const outputDirectoryRelativePathFile = vscode.workspace.getConfiguration('markdownenhance.export')['outputDirectoryRelativePathFile'];
        const root = vscode.workspace.getWorkspaceFolder(resource);
        if (outputDirectoryRelativePathFile === false && root) {
            const outputDir = path.join(root.uri.fsPath, outputDirectory);
            mkdir(outputDir);
            return path.join(outputDir, path.basename(filename));
        }

        // Otherwise, use path relative to markdown file
        const outputDir = path.join(path.dirname(resource.fsPath), outputDirectory);
        mkdir(outputDir);
        return path.join(outputDir, path.basename(filename));
    } catch (error) {
        showErrorMessage('getOutputDir()', error);
        return '';
    }
}

/**
 * Create directory
 */
export function mkdir(dirPath: string): string {
    if (isExistsDir(dirPath)) {
        return dirPath;
    }
    const mkdirp = require('mkdirp');
    return mkdirp.sync(dirPath);
}

/**
 * Read file content
 */
export function readFile(filename: string, encode: BufferEncoding | null = 'utf-8'): string | Buffer {
    if (filename.length === 0) {
        return '';
    }

    if (filename.indexOf('file://') === 0) {
        if (process.platform === 'win32') {
            filename = filename.replace(/^file:\/\/\//, '')
                .replace(/^file:\/\//, '');
        } else {
            filename = filename.replace(/^file:\/\//, '');
        }
    }

    if (isExistsPath(filename)) {
        return encode !== null ? fs.readFileSync(filename, encode) : fs.readFileSync(filename);
    } else {
        return '';
    }
}

/**
 * Initialize environment check, ensure Chrome or Chromium exists
 */
export function checkEnvironment(): void {
    try {
        if (checkPuppeteerBinary()) {
            INSTALL_CHECK = true;
        } else {
            installChromium();
        }
    } catch (error) {
        showErrorMessage('Environment initialization failed', error);
    }
}

/**
 * Check if Chrome or Chromium is installed
 */
export function isInstalled(): boolean {
    return INSTALL_CHECK;
}

/**
 * Check Puppeteer binary
 */
function checkPuppeteerBinary(): boolean {
    try {
        // Check executable path configured in settings.json
        const executablePath = vscode.workspace.getConfiguration('markdownenhance.export')['executablePath'] || '';
        if (isExistsPath(executablePath)) {
            INSTALL_CHECK = true;
            return true;
        }

        // Check bundled Chromium
        const puppeteer = require('puppeteer-core');
        const bundledPath = puppeteer.executablePath();
        if (isExistsPath(bundledPath)) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        showErrorMessage('checkPuppeteerBinary()', error);
        return false;
    }
}

/**
 * Install Chromium browser
 */
function installChromium(): void {
    try {
        vscode.window.showInformationMessage('[Markdown PDF] Installing Chromium ...');
        const statusbarmessage = vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ...');

        // Proxy settings
        setProxy();

        const StatusbarMessageTimeout = vscode.workspace.getConfiguration('markdownenhance.export')['StatusbarMessageTimeout'];
        const puppeteer = require('puppeteer-core');
        const browserFetcher = puppeteer.createBrowserFetcher();

        // Fix path issues - use node_modules from extension directory
        const extensionPath = vscode.extensions.getExtension('seiunzhang.markdownenhance')?.extensionPath || '';
        const packagePath = path.join(extensionPath, 'node_modules', 'puppeteer-core', 'package.json');

        let revision;
        try {
            revision = require(packagePath).puppeteer.chromium_revision;
        } catch (error) {
            console.log('Error loading puppeteer package.json, using hardcoded revision');
            // As a fallback, use hardcoded version number
            revision = '982053';  // Current Chromium version used by puppeteer-core 2.1.1
        }

        const revisionInfo = browserFetcher.revisionInfo(revision);

        // Download Chromium
        browserFetcher.download(revisionInfo.revision, onProgress)
            .then(() => browserFetcher.localRevisions())
            .then(onSuccess)
            .catch(onError);

        function onSuccess(localRevisions: string[]) {
            console.log('Chromium downloaded to ' + revisionInfo.folderPath);
            localRevisions = localRevisions.filter(rev => rev !== revisionInfo.revision);
            // Delete previous chromium versions
            const cleanupOldVersions = localRevisions.map(rev => browserFetcher.remove(rev));

            if (checkPuppeteerBinary()) {
                INSTALL_CHECK = true;
                statusbarmessage.dispose();
                vscode.window.setStatusBarMessage('$(markdown) Chromium installation successful!', StatusbarMessageTimeout);
                vscode.window.showInformationMessage('[Markdown PDF] Chromium installation successful.');
                return Promise.all(cleanupOldVersions);
            }
        }

        function onError(error: Error) {
            statusbarmessage.dispose();
            vscode.window.setStatusBarMessage('$(markdown) Error: Chromium download failed!', StatusbarMessageTimeout);
            showErrorMessage('Chromium download failed! If you are behind a proxy, please set the http.proxy option in settings.json and restart Visual Studio Code.', error);
        }

        function onProgress(downloadedBytes: number, totalBytes: number) {
            const progress = parseInt((downloadedBytes / totalBytes * 100).toString());
            vscode.window.setStatusBarMessage('$(markdown) Installing Chromium ' + progress + '%', StatusbarMessageTimeout);
        }
    } catch (error) {
        showErrorMessage('installChromium()', error);
    }
}

/**
 * Set proxy
 */
function setProxy(): void {
    const https_proxy = vscode.workspace.getConfiguration('http')['proxy'] || '';
    if (https_proxy) {
        process.env.HTTPS_PROXY = https_proxy;
        process.env.HTTP_PROXY = https_proxy;
    }
}

/**
 * Slugify string, used to generate titleID
 */
export function slugify(string: string): string {
    try {
        const stg = encodeURI(
            string.trim()
                .toLowerCase()
                .replace(/\s+/g, '-') // Replace spaces with -
                .replace(/[\]\[\!\'\#\$\%\&\(\)\*\+\,\.\/\:\;\<\=\>\?\@\\\^\_\{\|\}\~\`。，、；：？！…—·ˉ¨''""々～‖∶＂＇｀｜〃〔〕〈〉《》「」『』．〖〗【】（）［］｛｝]/g, '') // Remove punctuation
                .replace(/^\-+/, '') // Delete leading -
                .replace(/\-+$/, '') // Delete trailing -
        );
        return stg;
    } catch (error) {
        showErrorMessage('slugify()', error);
        return '';
    }
}

/**
 * Transform template text, replace supported placeholders
 */
export function transformTemplate(templateText: string): string {
    if (templateText.indexOf('%%ISO-DATETIME%%') !== -1) {
        templateText = templateText.replace('%%ISO-DATETIME%%', new Date().toISOString().substr(0, 19).replace('T', ' '));
    }
    if (templateText.indexOf('%%ISO-DATE%%') !== -1) {
        templateText = templateText.replace('%%ISO-DATE%%', new Date().toISOString().substr(0, 10));
    }
    if (templateText.indexOf('%%ISO-TIME%%') !== -1) {
        templateText = templateText.replace('%%ISO-TIME%%', new Date().toISOString().substr(11, 8));
    }

    return templateText;
}

/**
 * Create CSS style string
 */
export function makeCss(filename: string): string {
    try {
        const css = readFile(filename) as string;
        if (css) {
            return '\n<style>\n' + css + '\n</style>\n';
        } else {
            return '';
        }
    } catch (error) {
        showErrorMessage('makeCss()', error);
        return '';
    }
}

/**
 * Read all styles
 */
export function readStyles(uri: vscode.Uri): string {
    try {
        let includeDefaultStyles;
        let style = '';
        let styles: string | string[] = '';
        let filename = '';
        let i: number;

        includeDefaultStyles = vscode.workspace.getConfiguration('markdownenhance.export')['includeDefaultStyles'];

        // 1. Read vscode styles
        if (includeDefaultStyles) {
            filename = path.join(__dirname, '..', '..', '..', 'styles', 'markdown.css');
            style += makeCss(filename);
        }

        // 2. Read markdown.styles settings styles
        if (includeDefaultStyles) {
            styles = vscode.workspace.getConfiguration('markdown')['styles'];
            if (styles && Array.isArray(styles) && styles.length > 0) {
                for (i = 0; i < styles.length; i++) {
                    const href = fixHref(uri, styles[i]);
                    style += '<link rel="stylesheet" href="' + href + '" type="text/css">';
                }
            }
        }

        // 3. Read highlight.js styles
        const highlightStyle = vscode.workspace.getConfiguration('markdownenhance.export')['highlightStyle'] || '';
        const ishighlight = vscode.workspace.getConfiguration('markdownenhance.export')['highlight'];
        if (ishighlight) {
            if (highlightStyle) {
                const css = vscode.workspace.getConfiguration('markdownenhance.export')['highlightStyle'] || 'github.css';
                filename = path.join(__dirname, '..', '..', '..', 'node_modules', 'highlight.js', 'styles', css);
                style += makeCss(filename);
            } else {
                filename = path.join(__dirname, '..', '..', '..', 'styles', 'tomorrow.css');
                style += makeCss(filename);
            }
        }

        // 4. Read markdownenhance.export styles
        if (includeDefaultStyles) {
            filename = path.join(__dirname, '..', '..', '..', 'styles', 'markdown-pdf.css');
            style += makeCss(filename);
        }

        // 5. Read markdownenhance.export.styles settings styles
        styles = vscode.workspace.getConfiguration('markdownenhance.export')['styles'] || '';
        if (styles && Array.isArray(styles) && styles.length > 0) {
            for (i = 0; i < styles.length; i++) {
                const href = fixHref(uri, styles[i]);
                style += '<link rel="stylesheet" href="' + href + '" type="text/css">';
            }
        }

        return style;
    } catch (error) {
        showErrorMessage('readStyles()', error);
        return '';
    }
}

/**
 * Fix href path
 */
export function fixHref(resource: vscode.Uri, href: string): string {
    try {
        if (!href) {
            return href;
        }

        // If it's already a URL, use it directly
        const hrefUri = vscode.Uri.parse(href);
        if (['http', 'https'].indexOf(hrefUri.scheme) >= 0) {
            return hrefUri.toString();
        }

        // If it starts with ~, use path relative to home directory
        if (href.indexOf('~') === 0) {
            return vscode.Uri.file(href.replace(/^~/, os.homedir())).toString();
        }

        // If it's an absolute path, use file URI
        if (path.isAbsolute(href)) {
            return vscode.Uri.file(href).toString();
        }

        // If workspace exists and markdownenhance.export.stylesRelativePathFile is false, use path relative to workspace
        const stylesRelativePathFile = vscode.workspace.getConfiguration('markdownenhance.export')['stylesRelativePathFile'];
        const root = vscode.workspace.getWorkspaceFolder(resource);
        if (stylesRelativePathFile === false && root) {
            return vscode.Uri.file(path.join(root.uri.fsPath, href)).toString();
        }

        // Otherwise, use path relative to markdown file
        return vscode.Uri.file(path.join(path.dirname(resource.fsPath), href)).toString();
    } catch (error) {
        showErrorMessage('fixHref()', error);
        return href;
    }
}

/**
 * Create complete HTML document
 */
export async function makeHtml(data: string, uri: vscode.Uri): Promise<string> {
    try {
        // Read styles
        const style = readStyles(uri);

        // Get title
        const title = path.basename(uri.fsPath);

        // Read template
        const templatePath = path.join(__dirname, '..', '..', '..', 'template', 'template.html');
        const template = readFile(templatePath) as string;

        // Read mermaid JavaScript
        const mermaidServer = vscode.workspace.getConfiguration('markdownenhance.export')['mermaidServer'] || 'https://unpkg.com/mermaid';
        const mermaid = '<script src="' + mermaidServer + '/dist/mermaid.min.js"></script>';

        // Read KaTeX resources from configuration
        const katexServer = vscode.workspace.getConfiguration('markdownenhance.export')['katexServer'] || 'https://unpkg.com/katex';
        const katexCss = '<link rel="stylesheet" href="' + katexServer + '/dist/katex.min.css">';
        const katexJs = '<script src="' + katexServer + '/dist/katex.min.js"></script>';
        const autoRenderJs = '<script src="' + katexServer + '/dist/contrib/auto-render.min.js"></script>';
        const katexInit = `<script>
      document.addEventListener("DOMContentLoaded", function() {
        renderMathInElement(document.body, {
          delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\\\(", right: "\\\\)", display: false},
            {left: "\\\\[", right: "\\\\]", display: true}
          ],
          throwOnError: false
        });
      });
    </script>`;

        // Combine all KaTeX resources
        const katex = katexCss + katexJs + autoRenderJs + katexInit;

        // Compile template
        const mustache = require('mustache');
        const view = {
            title: title,
            style: style,
            content: data,
            mermaid: mermaid,
            katex: katex
        };

        return mustache.render(template, view);
    } catch (error) {
        showErrorMessage('makeHtml()', error);
        return '';
    }
}

/**
 * Convert image path to complete path
 */
export function convertImgPath(src: string, filename: string): string {
    try {
        let href = decodeURIComponent(src);
        href = href.replace(/("|')/g, '')
            .replace(/\\/g, '/')
            .replace(/#/g, '%23');
        const protocol = url.parse(href).protocol;
        if (protocol === 'file:' && href.indexOf('file:///') !== 0) {
            return href.replace(/^file:\/\//, 'file:///');
        } else if (protocol === 'file:') {
            return href;
        } else if (!protocol || path.isAbsolute(href)) {
            href = path.resolve(path.dirname(filename), href).replace(/\\/g, '/')
                .replace(/#/g, '%23');
            if (href.indexOf('//') === 0) {
                return 'file:' + href;
            } else if (href.indexOf('/') === 0) {
                return 'file://' + href;
            } else {
                return 'file:///' + href;
            }
        } else {
            return src;
        }
    } catch (error) {
        showErrorMessage('convertImgPath()', error);
        return src;
    }
}

/**
 * Set boolean value, use first value if false return false, otherwise return first or second value
 */
export function setBooleanValue(a: any, b: any): boolean {
    if (a === false) {
        return false;
    } else {
        return a || b;
    }
}

/**
 * Convert Markdown to HTML
 */
export async function convertMarkdownToHtml(filename: string, type: string, text: string): Promise<string> {
    try {
        const statusbarmessage = vscode.window.setStatusBarMessage('$(markdown) Converting (convertMarkdownToHtml) ...');

        // Use gray-matter to parse front matter
        const grayMatter = require("gray-matter");
        const matterParts = grayMatter(text);

        try {
            // Use highlight.js for syntax highlighting
            const hljs = require('highlight.js');

            // Set whether to preserve line breaks
            const breaks = setBooleanValue(matterParts.data.breaks, vscode.workspace.getConfiguration('markdownenhance.export')['breaks']);

            // Create markdown-it instance
            const md = require('markdown-it')({
                html: true,
                breaks: breaks,
                highlight: function (str: string, lang: string) {
                    // Special handling for mermaid charts
                    if (lang && lang.match(/\bmermaid\b/i)) {
                        return `<div class="mermaid">${str}</div>`;
                    }

                    // Special handling for LaTeX math blocks
                    if (lang && lang.match(/\bmath\b/i)) {
                        return `<div class="math">${str}</div>`;
                    }

                    // Syntax highlighting processing
                    if (lang && hljs.getLanguage(lang)) {
                        try {
                            return '<pre class="hljs"><code><div>' +
                                hljs.highlight(lang, str, true).value +
                                '</div></code></pre>';
                        } catch (error) {
                            const mdUtils = require('markdown-it')().utils;
                            showErrorMessage('markdown-it:highlight', error);
                            return '<pre class="hljs"><code><div>' +
                                mdUtils.escapeHtml(str) +
                                '</div></code></pre>';
                        }
                    } else {
                        const mdUtils = require('markdown-it')().utils;
                        return '<pre class="hljs"><code><div>' +
                            mdUtils.escapeHtml(str) +
                            '</div></code></pre>';
                    }
                }
            });

            // Convert image src in markdown
            const cheerio = require('cheerio');
            const defaultRender = md.renderer.rules.image;
            md.renderer.rules.image = function (tokens: any, idx: number, options: any, env: any, self: any) {
                const token = tokens[idx];
                const href = token.attrs[token.attrIndex('src')][1];
                if (type === 'html') {
                    token.attrs[token.attrIndex('src')][1] = decodeURIComponent(href).replace(/("|')/g, '');
                } else {
                    token.attrs[token.attrIndex('src')][1] = convertImgPath(href, filename);
                }
                // Call default renderer
                return defaultRender(tokens, idx, options, env, self);
            };

            if (type !== 'html') {
                // Convert image src in HTML block
                md.renderer.rules.html_block = function (tokens: any, idx: number) {
                    const html = tokens[idx].content;
                    const $ = cheerio.load(html);
                    $('img').each(function (this: any) {
                        const src = $(this).attr('src');
                        const href = convertImgPath(src, filename);
                        $(this).attr('src', href);
                    });
                    return $.html();
                };
            }

            // Checkbox support
            md.use(require('markdown-it-checkbox'));

            // Emoji support
            const emoji_f = setBooleanValue(matterParts.data.emoji, vscode.workspace.getConfiguration('markdownenhance.export')['emoji']);
            if (emoji_f) {
                const emojies_defs = require(path.join(__dirname, '..', '..', '..', 'data', 'emoji.json'));
                const options = {
                    defs: emojies_defs
                };
                md.use(require('markdown-it-emoji'), options);
                md.renderer.rules.emoji = function (token: any, idx: number) {
                    const emoji = token[idx].markup;
                    const emojiPath = path.join(__dirname, '..', '..', '..', 'node_modules', 'emoji-images', 'pngs', emoji + '.png');
                    const emojiData = readFile(emojiPath, null).toString('base64');
                    if (emojiData) {
                        return '<img class="emoji" alt="' + emoji + '" src="data:image/png;base64,' + emojiData + '" />';
                    } else {
                        return ':' + emoji + ':';
                    }
                };
            }

            // Directory support
            const options = {
                slugify: slugify
            };
            md.use(require('markdown-it-named-headers'), options);

            // markdown-it-container support
            md.use(require('markdown-it-container'), '', {
                validate: function (name: string) {
                    return name.trim().length;
                },
                render: function (tokens: any, idx: number) {
                    if (tokens[idx].info.trim() !== '') {
                        return `<div class="${tokens[idx].info.trim()}">\n`;
                    } else {
                        return `</div>\n`;
                    }
                }
            });

            // PlantUML support
            const plantumlOptions = {
                openMarker: matterParts.data.plantumlOpenMarker || vscode.workspace.getConfiguration('markdownenhance.export')['plantumlOpenMarker'] || '@startuml',
                closeMarker: matterParts.data.plantumlCloseMarker || vscode.workspace.getConfiguration('markdownenhance.export')['plantumlCloseMarker'] || '@enduml',
                server: vscode.workspace.getConfiguration('markdownenhance.export')['plantumlServer'] || 'http://www.plantuml.com/plantuml'
            };
            md.use(require('markdown-it-plantuml'), plantumlOptions);

            // LaTeX math support
            md.use(require('markdown-it-katex'));

            // File inclusion support
            if (vscode.workspace.getConfiguration('markdownenhance.export')['markdown-it-include']['enable']) {
                md.use(require("markdown-it-include"), {
                    root: path.dirname(filename),
                    includeRe: /:\[.+\]\((.+\..+)\)/i
                });
            }

            statusbarmessage.dispose();
            return md.render(matterParts.content);
        } catch (error) {
            statusbarmessage.dispose();
            showErrorMessage('markdown rendering configuration failed', error);
            return '';
        }
    } catch (error) {
        showErrorMessage('convertMarkdownToHtml()', error);
        return '';
    }
}
