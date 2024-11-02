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
const layerShiftSize = 10;
const circleRadius = 15;
let matrixData: { row: string, col: string, layer: string, status: string }[] = [];
let rows: string[] = [];
let cols: string[] = [];
let layers: string[] = [];

const DEFAULT_MATRIX_HEAD = "Empty Matrix." as string;

// Function to clear and initialize canvas
function clearMatrix() {
    matrixData = [];
    rows = [];
    cols = [];
    layers = [];
    session_status.innerText = DEFAULT_MATRIX_HEAD;

    drawMatrix();
}

function getCssConfigProperty(propertyName: string){
    return getComputedStyle(document.documentElement).getPropertyValue("--vscode-"+propertyName.split('.').join('-'));
}

class ColorSettings {
    public planned = getCssConfigProperty('editor.foreground');
    public passed = 'green';
    public failed = 'red';
    public skipped = 'yellow';
    public text = getCssConfigProperty('activityBarBadge.background');
    public rim = 'black';
}

function count(ls: boolean[]): number {
    let res = 0;
    ls.forEach((elem) => {
        res += elem ? 1 : 0;
    });
    return res;
}

function updateSessionStatus() {
    const planned: number =  count(matrixData.map((elem) => elem.status == "planned"));
    const passed: number =  count(matrixData.map((elem) => elem.status == "passed"));
    const failed: number =  count(matrixData.map((elem) => elem.status == "failed"));
    const skipped: number =  count(matrixData.map((elem) => elem.status == "skipped"));
    
    const completed = passed+failed+skipped;
    const total = completed+planned;

    session_status.innerText = `Completed: ${completed}/${total}, Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}`;
}

function getTextHeight(ctx: CanvasRenderingContext2D, text: string): number {
    // Measure the width of text
    const metrics = ctx.measureText(text);

    // Estimated text height based on font size. Adjust if necessary.
    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + 2;

    return Math.round(textHeight*1.2);
}

class Edges {
    public right: number;
    public left: number;
    public top: number;
    public bottom: number;

    constructor(right: number, left: number, top: number, bottom: number) {
        this.right = right;
        this.left = left;
        this.top = top;
        this.bottom = bottom;
    }

    public update(x: number, y: number, width: number, actualHeight: number): void {
        this.left = Math.min(this.left, x);
        this.right = Math.max(this.right, x + width);
        this.top = Math.min(this.top, y - actualHeight);
        this.bottom = Math.max(this.bottom, y);
    }

    /**
     * Combines two Edges objects by finding the minimum and maximum boundaries.
     * @param edges1 The first Edges object.
     * @param edges2 The second Edges object.
     * @returns A new Edges object representing the combined boundaries of edges1 and edges2.
     */
    public static combine(edges1: Edges, edges2: Edges): Edges {
        const combined = new Edges(0, 0, 0, 0);
        combined.left = Math.min(edges1.left, edges2.left);
        combined.right = Math.max(edges1.right, edges2.right);
        combined.top = Math.min(edges1.top, edges2.top);
        combined.bottom = Math.max(edges1.bottom, edges2.bottom);
        return combined;
    }
}

/**
 * Wraps a canvas 2D context and used to write text, such that the edges of the written text can be easily tracked.
 * After the first text insertion, the edges will store the appropriate edge values, with respect to all of the text written using this object.
 */
class TextMaximizer {
    public ctx: CanvasRenderingContext2D;
    public base_x: number;
    public base_y: number;
    public edges: Edges;

    constructor(context: CanvasRenderingContext2D, base_x: number = 0, base_y: number = 0) {
        this.ctx = context;
        this.base_x = base_x;
        this.base_y = base_y;
        this.edges = new Edges(base_x, base_x, base_y, base_y);
    }

    public fillText(text: string, x: number, y: number, maxWidth?: number): void {
        const metrics = this.ctx.measureText(text);

        // Calculate width and height based on text metrics
        const width = metrics.width;
        const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

        x += this.base_x;
        y += this.base_y;

        // Update edges
        this.edges.update(x, y, width, actualHeight);

        // Draw the text on the canvas
        this.ctx.fillText(text, x, y, maxWidth);
    }

    /**
     * Combines the edges of this TextMaximizer with another TextMaximizer.
     * @param other Another TextMaximizer instance.
     */
    public combineEdges(other: TextMaximizer): TextMaximizer {
        let res = new TextMaximizer(this.ctx);
        res.edges = Edges.combine(this.edges, other.edges);
        return res;
    }
}

let minCellSize: number = 0;

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number = 5, color: string | CanvasGradient | CanvasPattern = "red"): void {
    const oldStyle = ctx.fillStyle;
    const oldWidth = ctx.lineWidth;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = oldStyle;
    ctx.lineWidth = oldWidth;
}

function drawEdges(ctx: CanvasRenderingContext2D, e: Edges): void {
    drawCircle(ctx, e.right, e.bottom);
    drawCircle(ctx, e.left, e.bottom);
    drawCircle(ctx, e.right, e.top);
    drawCircle(ctx, e.left, e.top);
}

// Function to draw the matrix grid based on matrixData
function drawMatrix() {
    updateSessionStatus();
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rows = [...new Set(matrixData.map(d => d.row))];
    cols = [...new Set(matrixData.map(d => d.col))];
    layers = [...new Set(matrixData.map(d => d.layer))];
    
    let row_start_positions: number[] = []
    let col_start_positions: number[] = []

    ctx.font = 'bolder 20px Arial';
    
    minCellSize = (layers.length+1)*circleRadius;
    const text_height_dist = getTextHeight(ctx, "a")
    const base_offset = text_height_dist+2
    const row_col_names_padding = text_height_dist;
    const colors = new ColorSettings();
    
    ctx.fillStyle = colors.text;
    ctx.strokeStyle = colors.rim;

    
    // Draw dimention labels for depth, height, length
    let layer_names = new TextMaximizer(ctx, base_offset, base_offset);
    layers.forEach((layer, layerIndex) => {
        layer_names.fillText(layer, layerIndex*text_height_dist, layerIndex*text_height_dist)
    });
    // drawEdges(ctx, layer_names.edges);

    let row_names = new TextMaximizer(ctx, base_offset, layer_names.edges.bottom+text_height_dist+row_col_names_padding);
    let next_row_start: number = 0;
    rows.forEach((row, rowIndex) => {
        row_names.fillText(row, 0, next_row_start);
        row_start_positions.push(next_row_start);
        next_row_start = Math.max(next_row_start + minCellSize, row_names.edges.bottom-row_names.edges.top + row_col_names_padding);
    });
    row_start_positions.push(next_row_start);
    // drawEdges(ctx, row_names.edges);

    let column_names = new TextMaximizer(ctx, Math.max(layer_names.edges.right, row_names.edges.right)+row_col_names_padding, base_offset);
    let next_col_start: number = 0;
    cols.forEach((col, colIndex) => {
        column_names.fillText(col, next_col_start, 0);
        col_start_positions.push(next_col_start);
        next_col_start = Math.max(next_col_start + minCellSize, column_names.edges.right-column_names.edges.left + row_col_names_padding);
    });
    col_start_positions.push(next_col_start);
    // drawEdges(ctx, column_names.edges);

    let base_points = new Set<{x: number, y: number}>()

    // Draw circles for cells
    matrixData.forEach(({ row, col, layer, status}) => {
        const rowIndex: number = rows.indexOf(row);
        const colIndex: number = cols.indexOf(col);
        const layerIndex: number = layers.indexOf(layer);
        
        const base_x = circleRadius + Edges.combine(layer_names.edges, row_names.edges).right;
        const base_y = circleRadius + Edges.combine(layer_names.edges, column_names.edges).bottom;

        if (rowIndex !== -1 && colIndex !== -1 && layerIndex != -1) {
            const layer_offset = layerIndex * layerShiftSize
            let x = base_x + (col_start_positions[colIndex]+col_start_positions[colIndex+1])/2 - layerShiftSize*layers.length/2;
            let y = base_y + (row_start_positions[rowIndex]+row_start_positions[rowIndex+1])/2 - layerShiftSize*layers.length/2;
            base_points.add({x: x, y: y});
            x += layer_offset;
            y += layer_offset;
            console.log("drawing circle at: ", x, y);
            drawCircle(ctx, x, y, circleRadius,colors[status as keyof ColorSettings] || colors.planned);
        }
    });
    const max_layer_offset = (layers.length-1) * layerShiftSize; 
    const cursor_offset = circleRadius/Math.sqrt(2);
    base_points.forEach(({x, y}) => {
        const base_point = 
        ctx.beginPath();
        ctx.moveTo(x+cursor_offset, y-cursor_offset);
        ctx.lineTo(x+max_layer_offset+cursor_offset, y+max_layer_offset-cursor_offset);
        ctx.stroke();
    });
}

function positionToRowCol(off_x: number, off_y: number): {row: string, col: string} | null {
    const colIndex = Math.floor(off_x / minCellSize) - 1;
    const rowIndex = Math.floor(off_y / minCellSize) - 1;
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
