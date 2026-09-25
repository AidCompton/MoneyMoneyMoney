"use client";

import { useState } from "react";

/**
 * Copies text to the clipboard. The async Clipboard API only exists in
 * secure contexts, and this app is usually opened over plain HTTP on the
 * home network, so fall back to the older execCommand route there.
 */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="glass inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-ivory transition-colors hover:bg-white/10"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}
