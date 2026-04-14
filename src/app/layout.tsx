import type { Metadata } from "next";
import { env } from "@/lib/env";
import { TopNavClient } from "@/components/TopNavClient";
import "./globals.css";

export const metadata: Metadata = {
  title: `${env.dashboardBrandName} Dashboard`,
  description: "Control moderation, raid gate, command toggles, and message templates."
};

function resolveCanonicalOrigin(): string {
  try {
    return new URL(env.fluxerRedirectUri).origin;
  } catch {
    return "";
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const canonicalOrigin = resolveCanonicalOrigin();
  const canonicalScript =
    canonicalOrigin &&
    `(() => {
  const targetOrigin = ${JSON.stringify(canonicalOrigin)};
  if (!targetOrigin || typeof window === "undefined") {
    return;
  }

  if (window.location.origin !== targetOrigin) {
    window.location.replace(targetOrigin + window.location.pathname + window.location.search + window.location.hash);
  }
})();`;

  return (
    <html lang="en">
      <body>
        {canonicalScript ? <script dangerouslySetInnerHTML={{ __html: canonicalScript }} /> : null}
        <TopNavClient brandName={env.dashboardBrandName} />
        {children}
      </body>
    </html>
  );
}
