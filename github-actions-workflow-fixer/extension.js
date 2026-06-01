const vscode = require('vscode');
const { fixGitHubWorkflowYml, isGitHubWorkflowFile } = require('./fixWorkflow');

function createFullDocumentEdit(document, fixedText) {
  const start = document.positionAt(0);
  const end = document.positionAt(document.getText().length);
  return vscode.TextEdit.replace(new vscode.Range(start, end), fixedText);
}

function activate(context) {
  const selector = [
    { language: 'yaml', scheme: 'file', pattern: '**/.github/workflows/*.yml' },
    { language: 'yaml', scheme: 'file', pattern: '**/.github/workflows/*.yaml' },
  ];

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(selector, {
      provideDocumentFormattingEdits(document) {
        if (!isGitHubWorkflowFile(document)) {
          return [];
        }

        const originalText = `${document.getText().replace(/\r\n/g, '\n').trimEnd()}\n`;
        const fixedText = fixGitHubWorkflowYml(document.getText());

        if (fixedText === originalText) {
          return [];
        }

        return [createFullDocumentEdit(document, fixedText)];
      },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('githubActionsWorkflowFixer.fixCurrentWorkflow', async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showInformationMessage('Open a GitHub Actions workflow file first.');
        return;
      }

      const { document } = editor;

      if (!isGitHubWorkflowFile(document)) {
        vscode.window.showInformationMessage('This command only works on .github/workflows YAML files.');
        return;
      }

      const originalText = `${document.getText().replace(/\r\n/g, '\n').trimEnd()}\n`;
      const fixedText = fixGitHubWorkflowYml(document.getText());

      if (fixedText === originalText) {
        vscode.window.showInformationMessage('The workflow file is already normalized.');
        return;
      }

      await editor.edit((editBuilder) => {
        editBuilder.replace(createFullDocumentEdit(document, fixedText).range, fixedText);
      });

      vscode.window.showInformationMessage('GitHub Actions workflow normalized.');
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};