import Layout from '@theme/Layout';
import React, { useCallback, useState } from 'react';

interface ParsedConfig {
  image: string;
  name?: string;
  ports?: string[];
  env?: string[];
  volumes?: string[];
  cmd?: string;
  entrypoint?: string;
  hostname?: string;
}

function parsePodmanRunCommand(command: string): ParsedConfig | undefined {
  const trimmed = command.trim();
  if (!trimmed) return undefined;

  // Tokenize respecting quoted strings
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  for (const char of trimmed) {
    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
      // eslint-disable-next-line quotes
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (char === ' ' || char === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);

  // Skip leading "podman run" or "docker run"
  let i = 0;
  if (tokens[0] === 'podman' || tokens[0] === 'docker') i++;
  if (tokens[i] === 'run') i++;

  const config: ParsedConfig = { image: '' };
  const ports: string[] = [];
  const envVars: string[] = [];
  const volumes: string[] = [];

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-p' || token === '--publish') {
      i++;
      if (i < tokens.length) ports.push(tokens[i]);
    } else if (token.startsWith('-p=') || token.startsWith('--publish=')) {
      ports.push(token.split('=', 2)[1]);
    } else if (token === '-e' || token === '--env') {
      i++;
      if (i < tokens.length) envVars.push(tokens[i]);
    } else if (token.startsWith('-e=') || token.startsWith('--env=')) {
      envVars.push(token.split('=', 2)[1]);
    } else if (token === '-v' || token === '--volume') {
      i++;
      if (i < tokens.length) volumes.push(tokens[i]);
    } else if (token.startsWith('-v=') || token.startsWith('--volume=')) {
      volumes.push(token.split('=', 2)[1]);
    } else if (token === '--name') {
      i++;
      if (i < tokens.length) config.name = tokens[i];
    } else if (token.startsWith('--name=')) {
      config.name = token.split('=', 2)[1];
    } else if (token === '--hostname' || token === '-h') {
      i++;
      if (i < tokens.length) config.hostname = tokens[i];
    } else if (token.startsWith('--hostname=')) {
      config.hostname = token.split('=', 2)[1];
    } else if (token === '--entrypoint') {
      i++;
      if (i < tokens.length) config.entrypoint = tokens[i];
    } else if (token.startsWith('--entrypoint=')) {
      config.entrypoint = token.split('=', 2)[1];
    } else if (
      token === '-d' ||
      token === '--detach' ||
      token === '--rm' ||
      token === '-i' ||
      token === '-t' ||
      token === '--interactive' ||
      token === '--tty'
    ) {
      // Skip boolean flags
    } else if (token.startsWith('-')) {
      // Skip unknown flags with values
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        i++;
      }
    } else {
      // Image name - first non-flag argument
      if (!config.image) {
        config.image = token;
      } else {
        // Remaining args are the command
        const remaining = tokens.slice(i).join(' ');
        config.cmd = remaining;
        break;
      }
    }
    i++;
  }

  if (!config.image) return undefined;

  if (ports.length > 0) config.ports = ports;
  if (envVars.length > 0) config.env = envVars;
  if (volumes.length > 0) config.volumes = volumes;

  return config;
}

function generateBadgeMarkdown(config: ParsedConfig): string {
  const json = JSON.stringify(config);
  const base64 = btoa(json);
  const url = `podman-desktop://run-image?config=${base64}`;
  return `[![Launch in Podman Desktop](https://img.shields.io/badge/Launch%20in-Podman%20Desktop-purple)](${url})`;
}

function LaunchGeneratorPage(): JSX.Element {
  const [input, setInput] = useState('');
  const [config, setConfig] = useState<ParsedConfig | undefined>();
  const [markdown, setMarkdown] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(() => {
    setError('');
    setCopied(false);
    const parsed = parsePodmanRunCommand(input);
    if (!parsed) {
      setError('Could not parse the command. Make sure it includes an image name.');
      setConfig(undefined);
      setMarkdown('');
      return;
    }
    setConfig(parsed);
    setMarkdown(generateBadgeMarkdown(parsed));
  }, [input]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdown]);

  return (
    <Layout title="Launch Badge Generator" description="Generate a 'Launch in Podman Desktop' badge for your README">
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2 text-center">Launch Badge Generator</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
          Paste a <code>podman run</code> or <code>docker run</code> command to generate a &quot;Launch in Podman
          Desktop&quot; badge for your README.
        </p>

        {/* Input */}
        <div className="mb-6">
          <label htmlFor="command-input" className="block text-sm font-medium mb-2">
            Container run command
          </label>
          <textarea
            id="command-input"
            className="w-full h-32 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            placeholder="podman run -d -p 8080:80 -e DEBUG=true --name my-nginx docker.io/nginx:latest"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
        </div>

        <div className="flex justify-center mb-8">
          <button
            onClick={handleGenerate}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
            Generate Badge
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {config && (
          <>
            {/* Parsed config preview */}
            <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Parsed Configuration</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                      Image
                    </td>
                    <td className="py-1 font-mono">{config.image}</td>
                  </tr>
                  {config.name && (
                    <tr>
                      <td className="py-1 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                        Name
                      </td>
                      <td className="py-1 font-mono">{config.name}</td>
                    </tr>
                  )}
                  {config.ports && (
                    <tr>
                      <td className="py-1 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                        Ports
                      </td>
                      <td className="py-1 font-mono">{config.ports.join(', ')}</td>
                    </tr>
                  )}
                  {config.env && (
                    <tr>
                      <td className="py-1 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                        Env
                      </td>
                      <td className="py-1 font-mono">{config.env.join(', ')}</td>
                    </tr>
                  )}
                  {config.volumes && (
                    <tr>
                      <td className="py-1 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                        Volumes
                      </td>
                      <td className="py-1 font-mono">{config.volumes.join(', ')}</td>
                    </tr>
                  )}
                  {config.cmd && (
                    <tr>
                      <td className="py-1 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                        Command
                      </td>
                      <td className="py-1 font-mono">{config.cmd}</td>
                    </tr>
                  )}
                  {config.entrypoint && (
                    <tr>
                      <td className="py-1 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                        Entrypoint
                      </td>
                      <td className="py-1 font-mono">{config.entrypoint}</td>
                    </tr>
                  )}
                  {config.hostname && (
                    <tr>
                      <td className="py-1 pr-4 font-medium text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                        Hostname
                      </td>
                      <td className="py-1 font-mono">{config.hostname}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Badge preview */}
            <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center">
              <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Badge Preview</h3>
              <img
                src="https://img.shields.io/badge/Launch%20in-Podman%20Desktop-purple"
                alt="Launch in Podman Desktop"
              />
            </div>

            {/* Markdown output */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Markdown</h3>
                <button
                  onClick={() => {
                    handleCopy().catch(console.error);
                  }}
                  className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-gray-900 text-green-400 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {markdown}
              </pre>
            </div>
          </>
        )}
      </main>
    </Layout>
  );
}

export default LaunchGeneratorPage;
