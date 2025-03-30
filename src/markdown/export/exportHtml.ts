import * as fs from 'fs';
import { showErrorMessage } from './utils';

/**
 * Export HTML to file
 */
export async function exportHtml(data: string, filename: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filename, data, 'utf-8', (error) => {
            if (error) {
                showErrorMessage('exportHtml()', error);
                reject(error);
                return;
            }
            resolve();
        });
    });
}
