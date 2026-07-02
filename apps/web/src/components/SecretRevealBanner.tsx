import { Button } from '@evu/kb-ui';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export type SecretRevealBannerProps = {
  label: string;
  value: string;
};

/**
 * One-time plaintext reveal shown after creating or rotating a credential.
 * The value is never available again, so offer a copy affordance up front.
 */
export function SecretRevealBanner({ label, value }: SecretRevealBannerProps) {
  // Track which value was copied so the indicator resets when a new secret is shown.
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const copied = copiedValue === value;

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
    } catch {
      setCopiedValue(null);
    }
  }

  return (
    <div className="evukb-secret-banner">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{label}</strong>
        <Button onClick={() => void handleCopy()} size="sm" type="button" variant="outline">
          {copied ? (
            <>
              <Check aria-hidden className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      <code>{value}</code>
    </div>
  );
}
