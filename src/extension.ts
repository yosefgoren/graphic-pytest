import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // Register the command that opens the webview
    const disposable = vscode.commands.registerCommand('extension.showWebview', () => {
        const panel = vscode.window.createWebviewPanel(
            'simpleWebview',
            'Simple Webview',
            vscode.ViewColumn.One,
            {
                enableScripts: true, // Required to allow running client-side JavaScript
            }
        );

        // Get path to the JavaScript file and create a URI for the webview
        const scriptPath = vscode.Uri.file(
            path.join(context.extensionPath, 'out', 'media', 'webview.js')
        );
        const scriptUri = panel.webview.asWebviewUri(scriptPath);

        // Load HTML content, replacing ${webviewUri} with the script URI
        const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview.html'));
        fs.readFile(htmlPath.fsPath, 'utf8', (err, data) => {
            if (err) {
                console.error('Could not read webview.html file:', err);
                return;
            }
            panel.webview.html = data.replace('${webviewUri}', scriptUri.toString());
        });

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showInformationMessage(message.text);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
