import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const session_name: string = "stuffs";
    const disposable = vscode.commands.registerCommand('extension.showWebview', () => {
        const panel = vscode.window.createWebviewPanel(
            'testMonitor',
            `Test Monitor: ${session_name}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const scriptPath = vscode.Uri.file(
            path.join(context.extensionPath, 'out', 'media', 'webview.js')
        );
        const scriptUri = panel.webview.asWebviewUri(scriptPath);

        const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview.html'));
        fs.readFile(htmlPath.fsPath, 'utf8', (err, data) => {
            if (err) {
                console.error('Could not read webview.html file:', err);
                return;
            }
            panel.webview.html = data.replace('${webviewUri}', scriptUri.toString());
        });

        // Function to load test data from summary.json
        const getMatrixData = () => {
            const summaryPath = path.join(vscode.workspace.rootPath || '.', 'summary.json');
            if (!fs.existsSync(summaryPath)) {
                vscode.window.showErrorMessage("summary.json file not found in workspace.");
                return [];
            }

            const summaryContent = fs.readFileSync(summaryPath, 'utf8');
            const summaryData = JSON.parse(summaryContent);

            const matrixData: { row: string, col: string, status: string }[] = [];
            for (const row in summaryData) {
                for (const col in summaryData[row]) {
                    const status = summaryData[row][col];
                    matrixData.push({ row, col, status });
                }
            }
            return matrixData;
        };

        // Send initial matrix data to webview
        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'loadMatrix') {
                    const matrixData = getMatrixData();
                    panel.webview.postMessage({ command: 'insertCells', data: matrixData });
                } else if (message.command === 'openFile') {
                    const filePath = path.join(vscode.workspace.rootPath || '.', `${message.file}.log`);
                    if (fs.existsSync(filePath)) {
                        const document = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(document);
                    } else {
                        vscode.window.showWarningMessage(`Log file ${message.file}.log does not exist.`);
                    }
                }
            },
            undefined,
            context.subscriptions
        );

        context.subscriptions.push(disposable);
    });
}

export function deactivate() {}
