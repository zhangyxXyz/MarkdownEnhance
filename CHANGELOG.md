## Release Notes

### 0.0.4

- Added feature to prevent page breaks inside math formulas in PDF export
- Added CSS rules to improve PDF pagination for tables, figures and code blocks
- Added configuration options for formula rendering timeout
- Fixed line ending inconsistencies across the codebase

### 0.0.3

- Added pre-packaging cleanup script to reduce extension package size
- Added KaTeX server configuration option for customizing LaTeX rendering CDN
- Fixed export functionality issues with large documents
- Improved error handling in image export
- Fixed runtime dependency issue with rimraf module
- Added Special Thanks section to README

### 0.0.2

- Integrated export functionality from [vscode-markdown-pdf](https://github.com/yzane/vscode-markdown-pdf), supporting PDF, HTML, PNG, and JPEG formats
    - Added support for LaTeX math formula rendering
    - Organized export menu items under Markdown Export menu

### 0.0.1

- Initial release, including table creation and dictionary completion features.
