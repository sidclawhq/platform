import { intro, outro, text, select, confirm, spinner, isCancel, cancel } from '@clack/prompts';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync, exec } from 'child_process';
import { scaffoldProject } from './scaffolder.js';
import { setupSidclawResources } from './api-setup.js';

const VALID_PROJECT_NAME = /^[a-zA-Z0-9._-]+$/;
const VALID_FRAMEWORKS = [
  'langchain-python', 'langchain-js', 'vercel-ai',
  'openai-agents-python', 'mcp-proxy', 'plain-typescript', 'plain-python',
] as const;

function validateProjectName(value: string): string | undefined {
  if (!value) return 'Project name is required';
  if (!VALID_PROJECT_NAME.test(value)) return 'Project name may only contain letters, numbers, dots, hyphens, and underscores';
  if (existsSync(resolve(value))) return `Directory "${value}" already exists`;
}

function parseFlags(args: string[]): {
  positional: string | undefined;
  framework: string | undefined;
  apiKey: string | undefined;
  apiUrl: string;
  help: boolean;
} {
  let positional: string | undefined;
  let framework: string | undefined;
  let apiKey: string | undefined;
  let apiUrl = 'https://api.sidclaw.com';
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if ((arg === '--framework' || arg === '-f') && i + 1 < args.length) {
      framework = args[++i]!;
    } else if ((arg === '--api-key' || arg === '-k') && i + 1 < args.length) {
      apiKey = args[++i]!;
    } else if (arg === '--api-url' && i + 1 < args.length) {
      apiUrl = args[++i]!;
    } else if (arg?.startsWith('--framework=')) {
      framework = arg.slice('--framework='.length);
    } else if (arg?.startsWith('--api-key=')) {
      apiKey = arg.slice('--api-key='.length);
    } else if (arg?.startsWith('--api-url=')) {
      apiUrl = arg.slice('--api-url='.length);
    } else if (arg && !arg.startsWith('-') && !positional) {
      positional = arg;
    }
  }

  return { positional, framework, apiKey, apiUrl, help };
}

function printHelp() {
  console.log(`
  create-sidclaw-app — Create a governed AI agent project

  Usage:
    npx create-sidclaw-app <project-name> [options]

  Options:
    -f, --framework <name>   Framework template (skip interactive prompt)
    -k, --api-key <key>      SidClaw API key (starts with ai_)
        --api-url <url>      API URL (default: https://api.sidclaw.com)
    -h, --help               Show this help message

  Frameworks:
    langchain-python         LangChain (Python) — most popular
    langchain-js             LangChain.js (TypeScript)
    vercel-ai                Vercel AI SDK (Next.js chat app)
    openai-agents-python     OpenAI Agents (Python)
    mcp-proxy                MCP Governance Proxy
    plain-typescript         Plain TypeScript (minimal)
    plain-python             Plain Python (minimal)

  Non-interactive example (for CI, scripts, or AI coding tools):
    npx create-sidclaw-app my-agent --framework plain-typescript --api-key ai_xxx

  Interactive example (prompts for all options):
    npx create-sidclaw-app my-agent
`);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  // Detect non-interactive mode: all required flags provided OR not a TTY
  const nonInteractive = !!(flags.positional && flags.framework) || !process.stdin.isTTY;

  // Validate framework flag if provided
  if (flags.framework && !VALID_FRAMEWORKS.includes(flags.framework as typeof VALID_FRAMEWORKS[number])) {
    console.error(`Error: Unknown framework "${flags.framework}". Valid options: ${VALID_FRAMEWORKS.join(', ')}`);
    process.exit(1);
  }

  // Non-interactive mode — use flags only, no prompts
  if (nonInteractive) {
    if (!flags.positional) {
      console.error('Error: Project name required. Usage: npx create-sidclaw-app <name> --framework <framework>');
      process.exit(1);
    }
    if (!flags.framework) {
      console.error(`Error: --framework required in non-interactive mode. Options: ${VALID_FRAMEWORKS.join(', ')}`);
      process.exit(1);
    }

    const nameError = validateProjectName(flags.positional);
    if (nameError) {
      console.error(`Error: ${nameError}`);
      process.exit(1);
    }

    console.log(`Creating ${flags.positional} with ${flags.framework} template...`);

    const projectDir = resolve(flags.positional);
    await scaffoldProject(projectDir, flags.framework, {
      projectName: flags.positional,
      apiKey: flags.apiKey || 'ai_your_key_here',
      apiUrl: flags.apiUrl,
    });
    console.log('Project scaffolded');

    // Set up SidClaw resources if API key provided
    if (flags.apiKey) {
      console.log('Setting up agent and policies...');
      try {
        const { agentId, failedPolicies } = await setupSidclawResources(flags.apiKey, flags.apiUrl, flags.positional);
        const envPath = resolve(projectDir, '.env');
        const envContent = readFileSync(envPath, 'utf-8');
        writeFileSync(envPath, envContent.replace('your_agent_id_here', agentId));
        console.log(failedPolicies > 0
          ? `Agent created, but ${failedPolicies}/3 policies failed`
          : 'Agent and 3 demo policies created');
      } catch (error) {
        console.log(`Could not create agent: ${error instanceof Error ? error.message : error}`);
        console.log('Create one manually at https://app.sidclaw.com/dashboard/agents');
      }
    }

    // Install dependencies
    console.log('Installing dependencies...');
    const isPython = flags.framework.includes('python');
    try {
      if (isPython) {
        try {
          execSync('python3 -m venv .venv', { cwd: projectDir, stdio: 'pipe' });
          const pip = process.platform === 'win32' ? '.venv\\Scripts\\pip' : '.venv/bin/pip';
          execSync(`${pip} install -r requirements.txt`, { cwd: projectDir, stdio: 'pipe' });
        } catch {
          execSync('pip install -r requirements.txt', { cwd: projectDir, stdio: 'pipe' });
        }
      } else {
        execSync('npm install', { cwd: projectDir, stdio: 'pipe' });
      }
      console.log('Dependencies installed');
    } catch {
      console.log('Could not install dependencies (run npm install or pip install manually)');
    }

    const runCmd = isPython ? 'source .venv/bin/activate && python main.py' : 'npm start';
    console.log(`\nDone! Next steps:\n  cd ${flags.positional}\n  ${runCmd}\n`);
    console.log('Dashboard: https://app.sidclaw.com/dashboard/approvals');
    process.exit(0);
  }

  // --- Interactive mode (TTY) ---

  intro('Create SidClaw App');

  // Project name — validate CLI arg if provided
  if (flags.positional) {
    const error = validateProjectName(flags.positional);
    if (error) {
      cancel(error);
      process.exit(1);
    }
  }

  const name = flags.positional ?? await text({
    message: 'Project name:',
    placeholder: 'my-governed-agent',
    validate: validateProjectName,
  });
  if (isCancel(name)) { cancel('Cancelled'); process.exit(0); }

  // Framework
  const framework = flags.framework ?? await select({
    message: 'Which framework?',
    options: [
      { value: 'langchain-python', label: 'LangChain (Python)', hint: 'Most popular — 47M monthly downloads' },
      { value: 'langchain-js', label: 'LangChain.js (TypeScript)' },
      { value: 'vercel-ai', label: 'Vercel AI SDK (TypeScript)', hint: 'Next.js chat app with governed tools' },
      { value: 'openai-agents-python', label: 'OpenAI Agents (Python)' },
      { value: 'mcp-proxy', label: 'MCP Governance Proxy', hint: 'Wrap any MCP server' },
      { value: 'plain-typescript', label: 'Plain TypeScript', hint: 'Minimal — just the SDK' },
      { value: 'plain-python', label: 'Plain Python', hint: 'Minimal — just the SDK' },
    ],
  });
  if (isCancel(framework)) { cancel('Cancelled'); process.exit(0); }

  // API key
  let apiKey: string | symbol | undefined = flags.apiKey;
  if (!apiKey) {
    const hasKey = await confirm({ message: 'Do you have a SidClaw API key?' });
    if (isCancel(hasKey)) { cancel('Cancelled'); process.exit(0); }

    if (hasKey) {
      apiKey = await text({
        message: 'API key:',
        placeholder: 'ai_...',
        validate: (v) => v?.startsWith('ai_') ? undefined : 'API key should start with "ai_"',
      });
    } else {
      exec('open https://app.sidclaw.com/signup || xdg-open https://app.sidclaw.com/signup || start https://app.sidclaw.com/signup', () => {});
      console.log('\n  Sign up at https://app.sidclaw.com/signup');
      console.log('  Then go to Settings → API Keys → Create Key\n');

      apiKey = await text({
        message: 'Paste your API key:',
        placeholder: 'ai_...',
        validate: (v) => v?.startsWith('ai_') ? undefined : 'API key should start with "ai_"',
      });
    }
    if (isCancel(apiKey)) { cancel('Cancelled'); process.exit(0); }
  }

  // API URL
  const apiUrl = flags.apiUrl !== 'https://api.sidclaw.com' ? flags.apiUrl : await text({
    message: 'SidClaw API URL:',
    placeholder: 'https://api.sidclaw.com',
    initialValue: 'https://api.sidclaw.com',
  });
  if (isCancel(apiUrl)) { cancel('Cancelled'); process.exit(0); }

  // Scaffold
  const s = spinner();

  s.start('Creating project...');
  const projectDir = resolve(name as string);
  await scaffoldProject(projectDir, framework as string, {
    projectName: name as string,
    apiKey: apiKey as string,
    apiUrl: apiUrl as string,
  });
  s.stop('Project created');

  // Set up SidClaw resources (agent + policies)
  s.start('Setting up agent and policies in SidClaw...');
  try {
    const { agentId, failedPolicies } = await setupSidclawResources(apiKey as string, apiUrl as string, name as string);
    // Replace agent ID placeholder in .env
    const envPath = resolve(projectDir, '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    writeFileSync(envPath, envContent.replace('your_agent_id_here', agentId));
    if (failedPolicies > 0) {
      s.stop(`Agent created, but ${failedPolicies} of 3 policies failed (create them manually in the dashboard)`);
    } else {
      s.stop('Agent and policies created');
    }
  } catch (error) {
    s.stop('Could not create agent (you can do this manually in the dashboard)');
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
    // Update .env with clear instructions since agent ID is still a placeholder
    const envPath = resolve(projectDir, '.env');
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      writeFileSync(envPath, envContent.replace(
        'SIDCLAW_AGENT_ID=your_agent_id_here',
        '# TODO: Create an agent at https://app.sidclaw.com/dashboard/agents and paste the ID below\nSIDCLAW_AGENT_ID=',
      ));
    } catch { /* ignore if .env doesn't exist */ }
    console.log('');
    console.log('  To finish setup:');
    console.log('  1. Go to https://app.sidclaw.com/dashboard/agents');
    console.log('  2. Create an agent');
    console.log('  3. Copy the agent ID into .env as SIDCLAW_AGENT_ID');
  }

  // Install dependencies
  s.start('Installing dependencies...');
  const isPython = (framework as string).includes('python');
  try {
    if (isPython) {
      try {
        // Create venv and install — use platform-appropriate pip path
        execSync('python3 -m venv .venv', { cwd: projectDir, stdio: 'pipe' });
        const pip = process.platform === 'win32'
          ? '.venv\\Scripts\\pip'
          : '.venv/bin/pip';
        execSync(`${pip} install -r requirements.txt`, { cwd: projectDir, stdio: 'pipe' });
      } catch {
        // Fallback: install without venv
        execSync('pip install -r requirements.txt', { cwd: projectDir, stdio: 'pipe' });
      }
    } else {
      execSync('npm install', { cwd: projectDir, stdio: 'pipe' });
    }
    s.stop('Dependencies installed');
  } catch {
    s.stop('Could not install dependencies (run npm install or pip install manually)');
  }

  // Done
  const runCmd = isPython
    ? `source .venv/bin/activate\n  python main.py`
    : 'npm start';

  outro(`
  Your governed agent is ready!

  cd ${name as string}
  ${runCmd}

  Then open the dashboard to see governance in action:
  https://app.sidclaw.com/dashboard/approvals

  The project includes 3 demo tools:
    search_docs     → Allowed instantly
    send_email      → Requires your approval
    export_data     → Blocked by policy

  Documentation: https://docs.sidclaw.com/docs/quickstart
  `);
}

main().catch(console.error);
