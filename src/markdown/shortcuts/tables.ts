'use strict';
import * as editorHelpers from './editorHelpers';

export function addTable() {
    return _addTable(false);
}

export function addTableWithHeader() {
    return _addTable(true);
}

const sampleTable = [
    "",
    "Column A | Column B | Column C",
    "---------|----------|---------",
    " A1 | B1 | C1",
    " A2 | B2 | C2",
    " A3 | B3 | C3"
].join("\n");

function _addTable(addHeader: boolean) {
    let editFunc;
    if (!editorHelpers.isAnythingSelected()) {
        editFunc = () => sampleTable;
    }
    else if (addHeader) {
        editFunc = convertToTableWithHeader;
    }
    else {
        editFunc = convertToTableWithoutHeader;
    }
    editorHelpers.replaceBlockSelection(editFunc);
}

const tableColumnSeparator = /([ ]{2,}|[\t])/gi;

function convertToTableWithoutHeader(text: string): string {
    const firstRow = text.match(/.+/);

    const columnSeparators = firstRow === null ? null : firstRow[0].match(tableColumnSeparator);

    const columnCount = columnSeparators === null ? 0 : columnSeparators.length;
    const line1 = [];
    for (let i = 0; i < columnCount + 1; i++) {
        line1.push("column" + i);
    }
    let tableHeader = line1.join(" | ") + "\n";
    tableHeader = tableHeader + tableHeader.replace(/[a-z0-9]/gi, "-");

    return tableHeader + text.replace(tableColumnSeparator, " | ");
}

function convertToTableWithHeader(text: string): string {
    const textAsTable = text.replace(tableColumnSeparator, " | ");

    const firstRow = textAsTable.match(/.+/)![0];

    const headerLine = firstRow.replace(/[^\|]/gi, "-");

    return firstRow + "\n" + headerLine + textAsTable.substring(firstRow.length);
}
