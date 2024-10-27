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

        // Function to scan for log files and return row/column names
        const getMatrixData = (): { row: string, col: string }[] => {
            const files = fs.readdirSync(vscode.workspace.rootPath || '.');
            const pattern = /^([^-]+)-([^-]+)\.log$/;
            const matrixData: { row: string, col: string }[] = [];

            files.forEach(file => {
                const match = file.match(pattern);
                if (match) {
                    const row = match[1];
                    const col = match[2];
                    matrixData.push({ row, col });
                }
            });

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
                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document);
                }
            },
            undefined,
            context.subscriptions
        );

        context.subscriptions.push(disposable);
    });
}

export function deactivate() {}
