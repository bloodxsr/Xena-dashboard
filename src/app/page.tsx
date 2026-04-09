"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

type ModuleSlide = {
  title: string;
  type: string;
  detail: string;
  bg: string;
};

const MODULES: ModuleSlide[] = [
  {
    title: "Raid Detection",
    type: "Security Core",
    detail: "Real-time join risk scoring and automatic gate activation.",
    bg: "#0d0d0d"
  },
  {
    title: "Verification Queue",
    type: "Moderation Flow",
    detail: "Manual approve/reject pipeline with audit-friendly status updates.",
    bg: "#090909"
  },
  {
    title: "TOTP Access",
    type: "Staff Control",
    detail: "Monthly security verification for privileged moderation actions.",
    bg: "#121212"
  },
  {
    title: "Guild Config",
    type: "Operations",
    detail: "Tune thresholds, gate mode, and verification URL from one panel.",
    bg: "#101010"
  }
];

const WORKFLOW_STEPS = [
  {
    num: "(01)",
    title: "Authenticate",
    items: ["Fluxer account login", "Staff permission filtering", "Session integrity checks"]
  },
  {
    num: "(02)",
    title: "Observe",
    items: ["Recent join risk timeline", "Pending verification queue", "Raid gate status feed"]
  },
  {
    num: "(03)",
    title: "Control",
    items: ["Enable/disable gate instantly", "Adjust raid thresholds", "Switch timeout/kick modes"]
  },
  {
    num: "(04)",
    title: "Resolve",
    items: ["Approve or reject entries", "Resolve verification queue", "Keep moderation actions consistent"]
  }
];

function HeroSection() {
  return (
    <section style={{ minHeight: "68vh", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <p className="eyebrow">Fluxer Security Platform</p>
      <h1 style={{ fontSize: "clamp(52px, 8vw, 102px)", lineHeight: 0.93, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
        Moderation Control.
        <br />
        Reimagined.
      </h1>
      <p className="muted" style={{ marginTop: "20px", maxWidth: "640px" }}>
        A cinematic-grade, TypeScript dashboard for anti-raid operations, staff verification workflows,
        and real-time guild security decisions in Fluxer.
      </p>
      <div className="row" style={{ marginTop: "26px" }}>
        <Link className="btn" href="/dashboard">
          Open Dashboard
        </Link>
        <Link className="btn alt" href="/login">
          Sign In
        </Link>
      </div>
    </section>
  );
}

function ModulesSection() {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);

  const canPrev = current > 0;
  const canNext = current < MODULES.length - 1;

  const progress = useMemo(() => `${String(current + 1).padStart(2, "0")}/${String(MODULES.length).padStart(2, "0")}`, [current]);

  return (
    <section id="modules" style={{ paddingTop: "clamp(80px, 10vw, 150px)" }}>
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: "54px" }} />
      <p className="section-label" style={{ marginBottom: "28px" }}>
        01 / Selected Modules
      </p>

      <div
        style={{ overflow: "hidden", cursor: "grab" }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          const diff = touchStartX.current - event.changedTouches[0].clientX;
          if (Math.abs(diff) > 45) {
            if (diff > 0) {
              setCurrent((value) => Math.min(value + 1, MODULES.length - 1));
            } else {
              setCurrent((value) => Math.max(value - 1, 0));
            }
          }
        }}
      >
        <div
          style={{
            display: "flex",
            transform: `translateX(-${current * 100}%)`,
            transition: "transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1)"
          }}
        >
          {MODULES.map((module, index) => (
            <article
              key={module.title}
              style={{
                width: "100%",
                flex: "0 0 100%",
                minHeight: "340px",
                background: module.bg,
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "32px"
              }}
            >
              <p className="mono" style={{ color: "var(--muted)" }}>
                / {String(index + 1).padStart(2, "0")}
              </p>
              <div>
                <h3 style={{ fontSize: "clamp(26px, 4vw, 46px)", lineHeight: 1, marginBottom: "10px" }}>{module.title}</h3>
                <p className="mono" style={{ marginBottom: "16px", color: "#b6b6b6" }}>
                  {module.type}
                </p>
                <p className="muted">{module.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
        <div className="row">
          <button className="btn" type="button" disabled={!canPrev} onClick={() => setCurrent((value) => Math.max(value - 1, 0))}>
            Prev
          </button>
          <button className="btn" type="button" disabled={!canNext} onClick={() => setCurrent((value) => Math.min(value + 1, MODULES.length - 1))}>
            Next
          </button>
        </div>
        <span className="mono" style={{ color: "var(--muted)" }}>
          {progress}
        </span>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section style={{ paddingTop: "clamp(90px, 11vw, 160px)" }}>
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: "54px" }} />
      <p className="section-label" style={{ marginBottom: "34px" }}>
        02 / From Alert to Resolution
      </p>

      <h2 style={{ fontSize: "clamp(34px, 5vw, 68px)", lineHeight: 1.04, letterSpacing: "-0.01em", textTransform: "uppercase", marginBottom: "56px" }}>
        Detect fast.
        <br />
        Decide clearly.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
        {WORKFLOW_STEPS.map((step) => (
          <article key={step.num} style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
            <p className="mono" style={{ color: "var(--muted)", marginBottom: "12px" }}>
              {step.num}
            </p>
            <h3 style={{ marginBottom: "12px", fontSize: "clamp(18px, 2vw, 24px)" }}>{step.title}</h3>
            <ul style={{ listStyle: "none", display: "grid", gap: "8px" }}>
              {step.items.map((item) => (
                <li key={item} className="muted" style={{ fontSize: "14px" }}>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer style={{ paddingTop: "clamp(90px, 10vw, 160px)" }}>
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: "30px" }} />
      <div className="row" style={{ justifyContent: "space-between", gap: "22px", marginBottom: "24px" }}>
        <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, fontSize: "14px" }}>
          Fluxer Security Deck
        </p>
        <p className="mono" style={{ color: "var(--muted)" }}>
          Built with Next.js + TypeScript
        </p>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: "20px" }} />
      <div className="row" style={{ justifyContent: "space-between" }}>
        <a className="link-hover mono" href="https://github.com/fluxerapp/fluxer" target="_blank" rel="noreferrer">
          Fluxer API
        </a>
        <Link className="link-hover mono" href="/dashboard">
          Dashboard
        </Link>
        <p className="mono" style={{ color: "var(--muted)" }}>
          Refined for operations under pressure.
        </p>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ModulesSection />
      <WorkflowSection />
      <FooterSection />

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="mono"
        style={{
          position: "fixed",
          right: "30px",
          bottom: "30px",
          border: "none",
          background: "transparent",
          color: "var(--muted)",
          cursor: "pointer",
          letterSpacing: "0.08em"
        }}
      >
        :/ Back to top
      </button>
    </>
  );
}
