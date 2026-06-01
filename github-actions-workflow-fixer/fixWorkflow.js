function isGitHubWorkflowFile(document) {
  return /(^|[\\/])\.github[\\/]workflows[\\/].+\.(ya?ml)$/i.test(document.uri.fsPath);
}

function slugifyJobName(name) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'build';
}

function normalizeOnBlock(lines) {
  const normalized = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (/^on\s*:/.test(trimmed)) {
      normalized.push('on:');
      continue;
    }

    if (/^(push|pull_request)\s*:/.test(trimmed)) {
      normalized.push(`  ${trimmed}`);
      continue;
    }

    if (/^branches\s*:/.test(trimmed)) {
      normalized.push(`    ${trimmed}`);
      continue;
    }

    if (/^-[^\S\n]*/.test(trimmed)) {
      normalized.push(`      ${trimmed.replace(/^-\s*/, '- ')}`);
      continue;
    }

    normalized.push(`    ${trimmed}`);
  }

  return normalized;
}

function normalizeStepBlock(blockLines) {
  const normalized = [];
  let mode = 'top';

  for (const line of blockLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (/^-(\s|$)/.test(trimmed)) {
      normalized.push(`      ${trimmed}`);
      mode = 'top';
      continue;
    }

    if (trimmed === 'with:') {
      normalized.push('        with:');
      mode = 'with';
      continue;
    }

    if (/^(name|uses|run|if|shell|working-directory|timeout-minutes|continue-on-error|id|permissions)\s*:/.test(trimmed)) {
      normalized.push(`        ${trimmed}`);
      mode = trimmed.startsWith('run:') ? 'run' : 'top';
      continue;
    }

    if (mode === 'with' || mode === 'run') {
      normalized.push(`          ${trimmed}`);
      continue;
    }

    normalized.push(`        ${trimmed}`);
  }

  return normalized;
}

function normalizeSingleJobWorkflow(linesAfterJobs) {
  const filtered = linesAfterJobs.filter((line) => line.trim() !== '');

  if (filtered.length === 0 || !filtered[0].trimStart().startsWith('- name:')) {
    return linesAfterJobs.map((line) => line.trimEnd());
  }

  const jobNameMatch = filtered[0].match(/^\s*-\s*name:\s*(.+)\s*$/);
  const jobName = jobNameMatch ? jobNameMatch[1].replace(/^['"]|['"]$/g, '') : 'Build';
  const jobId = slugifyJobName(jobName);

  const jobLines = filtered.slice(1);
  const jobFields = [];
  const stepBlocks = [];
  let currentStep = [];
  let inSteps = false;

  for (const line of jobLines) {
    const trimmed = line.trim();

    if (trimmed === 'steps:') {
      inSteps = true;

      if (currentStep.length > 0) {
        stepBlocks.push(currentStep);
        currentStep = [];
      }

      continue;
    }

    if (!inSteps) {
      if (trimmed !== '') {
        jobFields.push(trimmed);
      }

      continue;
    }

    if (/^-(\s|$)/.test(trimmed) && currentStep.length > 0) {
      stepBlocks.push(currentStep);
      currentStep = [line];
      continue;
    }

    if (/^-(\s|$)/.test(trimmed) && currentStep.length === 0) {
      currentStep.push(line);
      continue;
    }

    if (currentStep.length > 0) {
      currentStep.push(line);
    }
  }

  if (currentStep.length > 0) {
    stepBlocks.push(currentStep);
  }

  const normalized = [
    `  ${jobId}:`,
    `    name: ${jobName}`,
  ];

  for (const field of jobFields) {
    normalized.push(`    ${field}`);
  }

  normalized.push('    steps:');

  stepBlocks.forEach((stepBlock, index) => {
    const normalizedStep = normalizeStepBlock(stepBlock);

    if (index > 0) {
      normalized.push('');
    }

    normalized.push(...normalizedStep);
  });

  return normalized;
}

function fixGitHubWorkflowYml(text) {
  const normalizedText = text.replace(/\r\n/g, '\n').trimEnd();
  const lines = normalizedText.split('\n');
  const nameLine = lines.find((line) => /^\s*name\s*:/.test(line)) || 'name: GitHub Actions Workflow';
  const onIndex = lines.findIndex((line) => /^\s*on\s*:/.test(line));
  const jobsIndex = lines.findIndex((line) => /^\s*jobs\s*:/.test(line));

  if (onIndex === -1 || jobsIndex === -1 || onIndex > jobsIndex) {
    return `${normalizedText}\n`;
  }

  const firstJobLine = lines[jobsIndex + 1] || '';

  if (/^\s+[A-Za-z0-9_.-]+:\s*$/.test(firstJobLine) && !/^\s*-\s*name:/.test(firstJobLine)) {
    return `${normalizedText}\n`;
  }

  const onBlock = normalizeOnBlock(lines.slice(onIndex, jobsIndex));
  const jobsSection = normalizeSingleJobWorkflow(lines.slice(jobsIndex + 1));

  return [
    nameLine.trim(),
    '',
    ...onBlock,
    '',
    'jobs:',
    ...jobsSection,
    '',
  ].join('\n');
}

module.exports = {
  fixGitHubWorkflowYml,
  isGitHubWorkflowFile,
};