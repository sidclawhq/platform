/**
 * Copies the appropriate template to the project directory,
 * replacing {{projectName}} and other placeholders.
 */

import { cpSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

interface ScaffoldConfig {
  projectName: string;
  apiKey: string;
  apiUrl: string;
}

export async function scaffoldProject(
  targetDir: string,
  framework: string,
  config: ScaffoldConfig
): Promise<void> {
  // Resolve templates dir relative to the compiled output
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const templateDir = join(__dirname, '..', 'templates', framework);

  // Copy template
  cpSync(templateDir, targetDir, { recursive: true });

  // Rename dotfiles (npm strips .gitignore during publish, so templates store them without the dot)
  const gitignorePath = join(targetDir, 'gitignore');
  if (fileExists(gitignorePath)) {
    renameSync(gitignorePath, join(targetDir, '.gitignore'));
  }

  // Replace placeholders in all files
  replaceInDir(targetDir, {
    '{{projectName}}': config.projectName,
    '{{apiUrl}}': config.apiUrl,
  });

  // Create .env from .env.example with actual values
  const envExamplePath = join(targetDir, '.env.example');
  const envPath = join(targetDir, '.env');
  if (fileExists(envExamplePath)) {
    let envContent = readFileSync(envExamplePath, 'utf-8');
    envContent = envContent.replace('ai_your_key_here', config.apiKey);
    envContent = envContent.replace('https://api.sidclaw.com', config.apiUrl);
    writeFileSync(envPath, envContent);
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', '__pycache__']);

function replaceInDir(dir: string, replacements: Record<string, string>) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) {
        replaceInDir(fullPath, replacements);
      }
    } else if (stat.isFile() && !isBinary(entry)) {
      let content = readFileSync(fullPath, 'utf-8');
      for (const [pattern, replacement] of Object.entries(replacements)) {
        content = content.replaceAll(pattern, replacement);
      }
      writeFileSync(fullPath, content);
    }
  }
}

function isBinary(filename: string): boolean {
  const binaryExtensions = ['.png', '.jpg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  return binaryExtensions.some(ext => filename.endsWith(ext));
}

function fileExists(path: string): boolean {
  try { statSync(path); return true; } catch { return false; }
}
