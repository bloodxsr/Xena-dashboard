import Link from "next/link";
import { GuildConsoleClient } from "@/components/GuildConsoleClient";

export default async function GuildPage({
  params
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;

  return (
    <main>
      <div className="nav-actions" style={{ marginBottom: 12 }}>
        <Link href="/dashboard" className="btn">
          Back to Dashboard
        </Link>
      </div>
      <GuildConsoleClient guildId={guildId} />
    </main>
  );
}
