"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Login", href: "/login" },
  { label: "Logout", href: "/logout" }
];

const EXTERNAL_LINKS = [
  { label: "Fluxer", href: "https://github.com/fluxerapp/fluxer" },
  { label: "GitHub", href: "https://github.com/bloodxsr/orchids-use-the-attached-user-prompt-md-as-my-prompt-" }
];

export default function CinematicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [linksVisible, setLinksVisible] = useState(false);

  const openMenu = useCallback(() => {
    setOpen(true);
    window.setTimeout(() => setLinksVisible(true), 220);
  }, []);

  const closeMenu = useCallback(() => {
    setLinksVisible(false);
    window.setTimeout(() => setOpen(false), 320);
  }, []);

  return (
    <>
      <nav className="cine-nav">
        <Link href="/" className="cine-brand" aria-label="Go to homepage">
          :/
        </Link>
        <button onClick={open ? closeMenu : openMenu} className="cine-menu-btn" type="button">
          {open ? "Close" : "Menu"}
        </button>
      </nav>

      <div className={`cine-overlay ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="cine-overlay-inner">
          {NAV_LINKS.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className={`cine-overlay-link ${pathname === link.href ? "active" : ""} ${linksVisible ? "visible" : ""}`}
              style={{ transitionDelay: `${index * 70}ms` }}
            >
              {link.label}
            </Link>
          ))}

          <div className={`cine-overlay-divider ${linksVisible ? "visible" : ""}`} />

          {EXTERNAL_LINKS.map((link, index) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={`cine-overlay-sub ${linksVisible ? "visible" : ""}`}
              style={{ transitionDelay: `${(NAV_LINKS.length + index + 1) * 70}ms` }}
            >
              {link.label} ↗
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
