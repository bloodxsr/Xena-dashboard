import { DashboardHomeClient } from "@/components/DashboardHomeClient";

export default function DashboardPage() {
  return (
    <main>
      <div className="grid" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <DashboardHomeClient />
      </div>
    </main>
  );
}
