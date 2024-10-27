// src/media/webview.ts

declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

// Initialize vscode API
const vscode = acquireVsCodeApi();
console.log('Hello from the webview client-side script!');

// Set up canvas and drawing context
const canvas = document.getElementById('matrixCanvas') as HTMLCanvasElement;
const session_status = document.getElementById('session_status') as HTMLElement;
const try_ctx = canvas.getContext('2d');
if (try_ctx == null) {
    throw Error("unable to get canvas context.");
}
const ctx = try_ctx as CanvasRenderingContext2D;
const cellSize = 80;
const circleRadius = 20;
let matrixData: { row: string, col: string }[] = [];
let rows: string[] = [];
let cols: string[] = [];

const DEFAULT_MATRIX_HEAD = "Empty Matrix." as string;

// Function to clear and initialize canvas
function clearMatrix() {
    matrixData = [];
    rows = [];
    cols = [];
    session_status.innerText = DEFAULT_MATRIX_HEAD;

    drawMatrix();
}

function getCssConfigProperty(propertyName: string){
    return getComputedStyle(document.documentElement).getPropertyValue("--vscode-"+propertyName.split('.').join('-'));
}

class ColorSettings {
    public primaryStyle = getCssConfigProperty('activityBarBadge.background');
    public secondaryStyle = getCssConfigProperty('editor.foreground');
    public graphEdgeColor = getCssConfigProperty('editor.foreground');
    public nodeSymbolsColor = getCssConfigProperty('editor.background');
    public nodeTextColor = getCssConfigProperty('editor.foreground');
}

function updateSessionStatus() {
    session_status.innerText = "70%";
}

// Function to draw the matrix grid based on matrixData
function drawMatrix() {
    updateSessionStatus();
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rows = [...new Set(matrixData.map(d => d.row))];
    cols = [...new Set(matrixData.map(d => d.col))];

    // Draw row and column labels
    ctx.font = 'bolder 14px Arial';
    const colors = new ColorSettings();
    ctx.fillStyle = colors.nodeTextColor;
    ctx.strokeStyle = colors.primaryStyle;
    rows.forEach((row, rowIndex) => {
        ctx.fillText(row, 10, (rowIndex + 1) * cellSize);
    });
    cols.forEach((col, colIndex) => {
        ctx.fillText(col, (colIndex + 1) * cellSize, 20);
    });

    // Draw circles for cells
    matrixData.forEach(({ row, col }) => {
        const rowIndex = rows.indexOf(row);
        const colIndex = cols.indexOf(col);
        if (rowIndex !== -1 && colIndex !== -1) {
            const x = (colIndex + 1) * cellSize;
            const y = (rowIndex + 1) * cellSize;
            ctx.beginPath();
            ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.fillStyle = colors.secondaryStyle;
            ctx.fill();
            ctx.stroke();
        }
    });
}

function positionToRowCol(off_x: number, off_y: number): {row: string, col: string} | null {
    const colIndex = Math.floor(off_x / cellSize) - 1;
    const rowIndex = Math.floor(off_y / cellSize) - 1;
    if (colIndex >= 0 && rowIndex >= 0 && rowIndex < rows.length && colIndex < cols.length) {
        return {
            row: rows[rowIndex],
            col: cols[colIndex]
        }
    }
    return null;
}

// Handle hover and click events
canvas.addEventListener('mousemove', (event) => {
    const ret = positionToRowCol(event.offsetX, event.offsetY);
    if (ret != undefined) {
        const cellName = `${ret.row}-${ret.col}`;
        console.log('Hover over:', cellName);
    }
});


canvas.addEventListener('click', (event) => {
    const ret = positionToRowCol(event.offsetX, event.offsetY);
    if (ret != undefined) {
        const cellName = `${ret.row}-${ret.col}`;
        console.log('Clicked:', cellName);
        vscode.postMessage({ command: 'openFile', file: cellName });
    } else {
        throw Error("an invalid position was clicked")
    }

});

// Listen for messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'insertCells':
            matrixData = message.data;
            drawMatrix();
            break;
        case 'clearMatrix':
            matrixData = [];
            clearMatrix();
            break;
    }
});

// Request initial data load
vscode.postMessage({ command: 'loadMatrix' });
