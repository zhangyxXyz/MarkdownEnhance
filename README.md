# MarkdownEnhance

MarkdownEnhance is an enhanced Markdown editor extension that provides table creation, dictionary completion, and document export features, helping users edit Markdown documents more efficiently.

## Features

- **Table Creation**: Quickly insert tables through context menu or title bar icon.
- **Dictionary Completion**: Automatically provides dictionary suggestions when editing Markdown documents.
- **Export Capability**: Export Markdown documents to PDF, HTML, PNG, and JPEG formats.
- **LaTeX Support**: Render LaTeX mathematical formulas in exported documents.
- **PlantUML & Mermaid Support**: Create and render diagrams directly in your Markdown.

## Export Features

The export functionality in this extension is integrated with [vscode-markdown-pdf](https://github.com/yzane/vscode-markdown-pdf), providing the following capabilities:

- Convert Markdown files to PDF, HTML, PNG, or JPEG
- Support for custom styles
- Syntax highlighting in code blocks
- Table of contents generation
- Header and footer customization in PDFs
- Mathematics formula rendering with KaTeX
- Diagram rendering with PlantUML and Mermaid

## Requirements

- VS Code version ^1.60.0
- TypeScript and ESLint installation required for development and testing.

## Known Issues

- No known issues at this time.

## Working with Markdown

- Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
- Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
- Press `Ctrl+Space` to see a list of Markdown snippets.

## Thanks

- [vscode-markdown-pdf](https://github.com/yzane/vscode-markdown-pdf)
- markdown-it and its plugins
- highlight.js
- KaTeX
- Mermaid
- PlantUML

**Enjoy using MarkdownEnhance!**
