// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as mdShortcuts from './markdown/shortcuts/commands';
import * as mdExport from './markdown/export';
import * as mdDictionary from './markdown/extended/dictcompletion';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Extension "markdownenhance" is now active!');

	// Register Markdown shortcut commands
	mdShortcuts.register(context);

	// Activate dictionary completion functionality
	mdDictionary.activate(context);

	// Activate markdown export functionality
	mdExport.activate(context);

	// Set language configuration for Markdown, used for dictionary completion
	vscode.languages.setLanguageConfiguration('markdown', {
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
	});

	return {
		extendMarkdownIt(md: any) {
			return md;
		}
	};
}

// This method is called when your extension is deactivated
export function deactivate() {}
