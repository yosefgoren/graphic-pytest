// src/media/webview.ts

declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

// Declare `vscode` as the API object returned by `acquireVsCodeApi()`.
// @ts-ignore
const vscode = acquireVsCodeApi();
console.log(vscode)

console.log('Hello from the webview client-side script!');

// Listen for messages from the extension
window.addEventListener('message', event => {
    const message = event.data; // The JSON data from the extension
    console.log('Message received from extension:', message);
});

// Send a message to the extension when the button is clicked
document.getElementById('actionButton')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'alert', text: 'Button clicked in webview!?!' });
});
