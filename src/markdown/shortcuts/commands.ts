'use strict';
import * as vscode from 'vscode';
import * as tables from './tables';

interface Command {
    command: string;
    callback: () => void;
    label: string;
    description: string;
    showInCommandPalette: boolean;
}

const _commands: Command[] = [
    {
        command: 'addTable',
        callback: tables.addTable,
        label: 'Table',
        description: 'Tabular | values',
        showInCommandPalette: true
    },
    {
        command: 'addTableWithHeader',
        callback: tables.addTableWithHeader,
        label: 'Table (with header)',
        description: 'Tabular | values',
        showInCommandPalette: true
    }
];

export function register(context: vscode.ExtensionContext) {
    _commands.forEach((cmd) => {
        context.subscriptions.push(
            vscode.commands.registerCommand('markdownenhance.' + cmd.command, cmd.callback)
        );
    });
}
