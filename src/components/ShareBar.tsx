import { useState } from 'react';
import { buildShareUrl } from '../lib/shareUrl';

export default function ShareBar({ token, onClear }: { token: string; onClear: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = buildShareUrl(token);
  const long = url.length > 4000;

  return (
    <div className="share-warn" role="note">
      <div className="share-text">
        <strong>Privacy note:</strong> the token is embedded in this page's URL (in the <code>#fragment</code>, which
        is never sent to the server). Anyone who gets this link can decode the token — don't share production tokens.
        {long && (
          <>
            {' '}
            <strong>This URL is {url.length} characters long — some tools truncate URLs that large.</strong>
          </>
        )}
      </div>
      <div className="share-actions">
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy share link'}
        </button>
        <button onClick={onClear}>Clear token &amp; URL</button>
      </div>
    </div>
  );
}
