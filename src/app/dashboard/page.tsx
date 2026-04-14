import { DashboardHomeClient } from "@/components/DashboardHomeClient";

export default function DashboardPage() {
  return (
    <main>
      <div className="grid" style={{ gap: 16 }}>
        <section className="dashboard-page-header">
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p className="muted" style={{ margin: 0 }}>
            Choose a server and open its console to configure moderation, cards, and reaction automation.
          </p>
        </section>
        <DashboardHomeClient />
      </div>
    </main>
  );
}
