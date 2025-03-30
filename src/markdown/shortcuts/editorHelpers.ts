'use strict';
import * as vscode from 'vscode';

export function isAnythingSelected(): boolean {
    return !vscode.window.activeTextEditor!.selection.isEmpty;
}

export function replaceSelection(replaceFunc: (text: string) => string) {
    const editor = vscode.window.activeTextEditor!;
    const selection = editor.selection;

    const newText = replaceFunc(editor.document.getText(selection));
    return editor.edit((edit) => {
        edit.replace(selection, newText);
    });
}

export function replaceBlockSelection(replaceFunc: (text: string) => string) {
    const editor = vscode.window.activeTextEditor!;
    const selection = getBlockSelection();

    const newText = replaceFunc(editor.document.getText(selection));
    return editor.edit((edit) => {
        edit.replace(selection, newText);
    });
}

export function getSurroundingWord(editor: vscode.TextEditor, selection: vscode.Selection, wordPattern?: RegExp): vscode.Selection | null {
    const range = editor.document.getWordRangeAtPosition(selection.active, wordPattern);

    return range === null || range === undefined
        ? null
        : new vscode.Selection(range.start, range.end);
}

export function surroundSelection(startPattern: string | RegExp, endPattern?: string, wordPattern?: RegExp) {
    if (endPattern === undefined || endPattern === null) {
        endPattern = startPattern as string;
    }

    const editor = vscode.window.activeTextEditor!;
    let selection = editor.selection;

    if (!isAnythingSelected()) {
        const withSurroundingWord = getSurroundingWord(editor, selection, wordPattern);

        if (withSurroundingWord !== null) {
            selection = editor.selection = withSurroundingWord;
        }
    }

    // Note, even though we're expanding selection, there's still a potential chance
    // for collapsed, e.g. empty file, or just an empty line.
    if (!isAnythingSelected()) {
        const position = selection.active;
        const newPosition = position.with(position.line, position.character + (startPattern as string).length);

        return editor.edit((edit) => {
            edit.insert(selection.start, (startPattern as string) + endPattern);
        }).then(() => {
            editor.selection = new vscode.Selection(newPosition, newPosition);
        });
    } else if (isSelectionMatch(selection, startPattern, endPattern)) {
        return replaceSelection((text) => text.substring((startPattern as string).length, text.length - (startPattern as string).length - endPattern!.length));
    }
    else {
        return replaceSelection((text) => (startPattern as string) + text + endPattern);
    }
}

export function surroundBlockSelection(startPattern: string | RegExp, endPattern?: string, wordPattern?: RegExp) {
    if (endPattern === undefined || endPattern === null) {
        endPattern = startPattern as string;
    }

    const editor = vscode.window.activeTextEditor!;
    let selection = getBlockSelection();

    if (!isAnythingSelected()) {
        const withSurroundingWord = getSurroundingWord(editor, selection, wordPattern);

        if (withSurroundingWord !== null) {
            selection = editor.selection = withSurroundingWord;
        }
    }

    if (!isAnythingSelected()) {
        const position = selection.active;
        const newPosition = position.with(position.line + 1, 0);
        return editor.edit((edit) => {
            edit.insert(selection.start, (startPattern as string) + endPattern);
        }).then(() => {
            editor.selection = new vscode.Selection(newPosition, newPosition);
        });
    }
    else {
        if (isSelectionMatch(selection, startPattern, endPattern)) {
            return replaceBlockSelection((text) => text.substring((startPattern as string).length, text.length - (startPattern as string).length - endPattern!.length));
        }
        else {
            return replaceBlockSelection((text) => (startPattern as string) + text + endPattern);
        }
    }
}

function getBlockSelection(): vscode.Selection {
    const selection = vscode.window.activeTextEditor!.selection;

    if (selection.isEmpty) {
        return selection;
    }

    return new vscode.Selection(
        selection.start.with(undefined, 0),
        selection.end.with(selection.end.line + 1, 0)
    );
}

export function isMatch(startPattern: string | RegExp, endPattern?: string): boolean {
    return isSelectionMatch(vscode.window.activeTextEditor!.selection, startPattern, endPattern);
}

function isSelectionMatch(selection: vscode.Selection, startPattern: string | RegExp, endPattern?: string): boolean {
    const editor = vscode.window.activeTextEditor!;
    const text = editor.document.getText(selection);
    if (startPattern instanceof RegExp) {
        return startPattern.test(text);
    }

    return text.startsWith(startPattern) && text.endsWith(endPattern!);
}
