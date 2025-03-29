'use strict';
import * as vscode from 'vscode';
import * as fs from 'fs';

interface IndexedItems {
    [key: string]: vscode.CompletionItem[];
}

let indexedItems: IndexedItems = {};

export function activate(context: vscode.ExtensionContext) {
    // Copy dictionary file to extension directory
    const targetDictionaryPath = context.asAbsolutePath('dictionary.txt');
    const sourceDictionaryPath = 'E:/IDE/VSCode/PluginsDev/Code-Snippet/dictionary.txt';
    
    try {
        if (!fs.existsSync(targetDictionaryPath)) {
            fs.copyFileSync(sourceDictionaryPath, targetDictionaryPath);
        }
    } catch (error) {
        console.error(`Error copying dictionary file: ${error}`);
    }

    fs.readFile(targetDictionaryPath, (err, data) => {
        if (err) {
            console.error(`Error reading dictionary file: ${err}`);
            return;
        }

        const indexes = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
        indexes.forEach(i => {
            indexedItems[i] = [];
        });

        const words = data.toString().split(/\r?\n/);
        words.forEach(word => {
            if (word.trim() === '') {
                return;
            }
            const firstLetter = word.charAt(0).toLowerCase();
            if (indexes.includes(firstLetter)) {
                indexedItems[firstLetter].push(new vscode.CompletionItem(word, vscode.CompletionItemKind.Text));
            }
        });
    });

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('markdown', new DictionaryCompletionItemProvider("markdown"))
    );
}

/**
 * Provide completion according to the first letter
 */
class DictionaryCompletionItemProvider implements vscode.CompletionItemProvider {
    private fileType: string;

    constructor(fileType: string) {
        this.fileType = fileType;
    }

    provideCompletionItems(
        document: vscode.TextDocument, 
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Thenable<vscode.CompletionItem[]> | vscode.CompletionItem[] {
        const textBefore = document.lineAt(position.line).text.substring(0, position.character);

        let firstLetter: string;
        
        switch (this.fileType) {
            case "markdown":
                const cleanText = textBefore.replace(/\W/g, ' ');
                const words = cleanText.split(/[\s]+/);
                const lastWord = words.pop() || '';
                firstLetter = lastWord.charAt(0);
                return this.completeByFirstLetter(firstLetter);
            default:
                return Promise.resolve([]);
        }
    }

    private completeByFirstLetter(firstLetter: string): Thenable<vscode.CompletionItem[]> {
        if (!firstLetter || firstLetter === '') {
            return Promise.resolve([]);
        }

        if (firstLetter.toLowerCase() === firstLetter) {
            return Promise.resolve(indexedItems[firstLetter] || []);
        } else {
            const completions = (indexedItems[firstLetter.toLowerCase()] || [])
                .map(w => {
                    const newLabel = w.label as string;
                    const capitalizedLabel = newLabel.charAt(0).toUpperCase() + newLabel.slice(1);
                    return new vscode.CompletionItem(capitalizedLabel, vscode.CompletionItemKind.Text);
                });
            return Promise.resolve(completions);
        }
    }
} 