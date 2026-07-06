import { Button, cn, tabClassName } from '@evu/kb-ui';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildMcpHarnessGuides, MCP_TOKEN_PLACEHOLDER, type McpHarnessId } from '../mcp-setup.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

export type McpSetupGuideProps = {
  mcpToken?: string | null;
};

export function McpSetupGuide({ mcpToken = null }: McpSetupGuideProps) {
  const { selectedSlug } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [activeHarness, setActiveHarness] = useState<McpHarnessId>('cursor');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mcpToken) {
      setOpen(true);
    }
  }, [mcpToken]);

  const guides = useMemo(
    () => buildMcpHarnessGuides(mcpToken?.trim() || MCP_TOKEN_PLACEHOLDER, selectedSlug),
    [mcpToken, selectedSlug],
  );
  const guide = guides.find((entry) => entry.id === activeHarness) ?? guides[0];

  async function handleCopy(): Promise<void> {
    if (!guide) {
      return;
    }
    try {
      await navigator.clipboard.writeText(guide.configText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!guide) {
    return null;
  }

  return (
    <section className="evukb-panel">
      <button
        aria-controls="mcp-setup-guide-content"
        aria-expanded={open}
        className="flex w-full items-start gap-2 border-0 bg-transparent p-0 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ChevronDown
          aria-hidden
          className={cn(
            'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xl font-semibold tracking-tight">Connect MCP clients</span>
          {!open ? (
            <span className="text-sm font-normal text-muted-foreground">
              Streamable HTTP at <code>/mcp</code> — expand for Cursor, Claude Desktop, and other
              agent configs.
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-4" id="mcp-setup-guide-content">
          <p className="evukb-muted m-0">
            EvuKB exposes Streamable HTTP MCP at <code>/mcp</code>. Create a token below, then
            configure your agent with workspace <code>{selectedSlug}</code> and the bearer headers
            in each example.
          </p>
          <nav
            aria-label="MCP client harness"
            className="flex flex-wrap gap-6 border-b border-border"
          >
            {guides.map((entry) => (
              <button
                key={entry.id}
                className={tabClassName(activeHarness === entry.id)}
                onClick={() => setActiveHarness(entry.id)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">{guide.installHint}</p>
            <p className="m-0 text-xs text-muted-foreground">
              Config file: <code>{guide.configFilename}</code>
            </p>
            <div className="relative">
              <pre className="m-0 max-h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed">
                <code>{guide.configText}</code>
              </pre>
              <Button
                className="absolute right-3 top-3"
                onClick={() => void handleCopy()}
                type="button"
                variant="outline"
              >
                {copied ? 'Copied' : 'Copy config'}
              </Button>
            </div>
            {mcpToken ? (
              <p className="m-0 text-sm text-muted-foreground">
                Using the token you just created. It is shown once — copy the config now if you need
                it later.
              </p>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                Replace <code>{MCP_TOKEN_PLACEHOLDER}</code> with an MCP token from the section
                below.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
