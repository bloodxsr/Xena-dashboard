import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { getVerificationStatus, upsertVerificationStatus } from "@/lib/db";
import { clearFluxerMemberTimeout } from "@/lib/fluxer";
import { parseSnowflake } from "@/lib/snowflake";

type Props = {
  params: {
    guildId: string;
  };
};

export default async function VerifyPage({ params }: Props) {
  const guildId = parseSnowflake(params.guildId);
  const session = requireSession(`/verify/${params.guildId}`);

  let kind: "info" | "success" | "warn" | "error" = "info";
  let message = "";
  let timeoutMessage = "";

  if (!guildId) {
    kind = "error";
    message = "Invalid guild id in verification URL.";
  } else {
    const status = getVerificationStatus(guildId, session.userId);
    if (!status) {
      kind = "warn";
      message = "No pending verification entry found for your account in this guild.";
    } else if (status.status === "verified") {
      kind = "success";
      message = "Your account is already verified in this guild.";
    } else if (status.status !== "pending") {
      kind = "warn";
      message = `Your verification status is '${status.status}'. Contact staff if needed.`;
    } else {
      upsertVerificationStatus({
        guildId,
        userId: session.userId,
        status: "verified",
        riskScore: status.risk_score,
        verificationUrl: status.verification_url,
        reason: "Verified via TypeScript dashboard",
        verifiedByUserId: session.userId
      });

      kind = "success";
      message = "Verification complete. Your Fluxer account is now approved for this guild.";

      try {
        await clearFluxerMemberTimeout(guildId, String(session.userId), "Verification completed from dashboard");
      } catch {
        timeoutMessage = "Verification was saved, but timeout removal could not be confirmed. Contact staff if access does not update.";
      }
    }
  }

  return (
    <section className="panel" style={{ maxWidth: "760px", margin: "0 auto" }}>
      <p className="section-label" style={{ marginBottom: "18px" }}>
        05 / Member Verification
      </p>
      <h1 style={{ fontSize: "clamp(32px, 5vw, 58px)", textTransform: "uppercase", lineHeight: 1.02, marginBottom: "14px" }}>
        {session.username}
      </h1>
      <div className={`alert ${kind}`}>{message}</div>
      {timeoutMessage ? <p className="muted" style={{ marginTop: "14px" }}>{timeoutMessage}</p> : null}
      <div className="row" style={{ marginTop: "18px" }}>
        <Link className="btn" href="/dashboard">
          Return to Dashboard
        </Link>
      </div>
    </section>
  );
}
