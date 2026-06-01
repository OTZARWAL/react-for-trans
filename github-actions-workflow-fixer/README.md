# GitHub Actions Workflow Fixer

This VS Code extension normalizes GitHub Actions workflow YAML files under `.github/workflows/`.

It provides:

- A formatter for `.yml` and `.yaml` workflow files.
- A command named `Fix GitHub Actions Workflow YAML` for the current editor.

The formatter is intentionally narrow: it targets the common single-job workflow shape and rewrites malformed indentation into valid GitHub Actions syntax.