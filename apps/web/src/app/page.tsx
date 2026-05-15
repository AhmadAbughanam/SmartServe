import Link from "next/link";

/* ── Data ──────────────────────────────────────────── */

const modules = [
  {
    href: "/customer/start?branchId=seed-branch-1&tableCode=T1",
    title: "Customer Experience",
    subtitle: "Dine-in ordering",
    text: "QR entry, menu browsing, cart, payments, order tracking, reviews, and AI chatbot.",
    icon: "\u2615",
    action: "Open Demo",
  },
  {
    href: "/kitchen",
    title: "Kitchen (KDS)",
    subtitle: "Back-of-house",
    text: "Real-time order queue, fire/done per item, 86, undo, waste tracking, and station filters.",
    icon: "\u{1F525}",
    action: "Open Demo",
  },
  {
    href: "/waiter",
    title: "Waiter Operations",
    subtitle: "Front-of-house",
    text: "Live floor map, service request queue, quick-add, payment confirmation, table lifecycle.",
    icon: "\u{1F37D}\uFE0F",
    action: "Open Demo",
  },
  {
    href: "/admin",
    title: "Admin Console",
    subtitle: "Management & POS",
    text: "Dashboard with KPIs, POS, menu management, staff & roles, inventory, promotions, analytics.",
    icon: "\u2699\uFE0F",
    action: "Open Demo",
  },
];

const credentials = [
  { role: "Owner",   email: "owner@demo.com",   icon: "\u{1F451}", desc: "Full access to all modules, analytics, and settings" },
  { role: "Kitchen", email: "chef@demo.com",     icon: "\u{1F468}\u200D\u{1F373}", desc: "KDS queue, item status controls, 86 actions" },
  { role: "Waiter",  email: "waiter@demo.com",   icon: "\u{1F9CD}", desc: "Floor map, service requests, payment confirmation" },
  { role: "Cashier", email: "cashier@demo.com",  icon: "\u{1F4B3}", desc: "POS ordering, payments, shifts, till reconciliation" },
];

const steps = [
  { n: "1", text: "Choose a module from Explore Modules above" },
  { n: "2", text: "Sign in using demo credentials (password: password123)" },
  { n: "3", text: "Explore the workflow and connected surfaces" },
  { n: "4", text: "Reset and switch to another role to see a different perspective" },
];

const notes = [
  "Customer ordering simulates scanning a QR code at Table T1",
  "Orders placed by customers appear instantly on the Kitchen Display",
  "Service requests from customers show up in the Waiter action queue",
  "The Admin dashboard shows live KPIs that update as orders flow through",
  "Stripe payment is ready \u2014 uses mock gateway in demo mode",
  "Two branches are seeded: Downtown and Waterfront (switch in Admin)",
];

/* ── Page ──────────────────────────────────────────── */

export default function HomePage() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-50)" }}>
      {/* Top bar */}
      <nav className="flex items-center justify-between px-6 py-3 md:px-10" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{time} &middot; {date}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full px-3 py-1 font-mono text-[10px] font-semibold sm:inline-flex" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", border: "1px solid var(--accent-edge)" }}>Demo Environment</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-sm font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</span>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
        {/* Hero / brand */}
        <header className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--r-lg)] font-serif text-2xl font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <h1 className="mt-4 font-serif text-3xl font-extrabold tracking-tight md:text-[38px]" style={{ color: "var(--ink-900)" }}>
            Demo <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Hub</em>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-500)" }}>
            Explore each app area, use sample credentials, and follow the quick start guide.
          </p>
        </header>

        {/* ── Explore Modules ───────────────────────────── */}
        <section className="mt-10">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>&rarr;</span>
            <h2 className="font-serif text-lg font-bold" style={{ color: "var(--ink-900)" }}>Explore <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Modules</em></h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m) => (
              <div key={m.href} className="flex flex-col rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] text-lg" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)" }}>{m.icon}</div>
                <h3 className="mt-3 font-serif text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>{m.title}</h3>
                <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--accent)" }}>{m.subtitle}</p>
                <p className="mt-2 flex-1 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{m.text}</p>
                <Link href={m.href}
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition hover:opacity-90"
                  style={{ background: "var(--ink-0)", color: "var(--accent)", border: "1px solid var(--accent-edge)" }}>
                  {m.action} <span>&rarr;</span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── Credentials + Quick Start ─────────────────── */}
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Demo Credentials */}
          <section className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>&#x1F511;</span>
              <h2 className="font-serif text-lg font-bold" style={{ color: "var(--ink-900)" }}>Demo <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Credentials</em></h2>
            </div>
            <p className="mb-3 font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>
              All accounts use password: <code className="rounded px-1.5 py-0.5 font-semibold" style={{ background: "var(--ink-100)", color: "var(--accent)" }}>password123</code>
            </p>
            <div className="space-y-2">
              {credentials.map((c) => (
                <div key={c.email} className="flex items-center gap-3 rounded-[var(--r-md)] px-3.5 py-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                  <span className="text-lg">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{c.role}</span>
                      <code className="font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>{c.email}</code>
                    </div>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-400)" }}>{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Start Guide */}
          <section className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>#</span>
              <h2 className="font-serif text-lg font-bold" style={{ color: "var(--ink-900)" }}>Quick Start <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Guide</em></h2>
            </div>
            <div className="space-y-3">
              {steps.map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>{s.n}</span>
                  <p className="pt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--ink-600)" }}>{s.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[var(--r-md)] p-3.5" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)" }}>
              <p className="font-mono text-[11px] font-medium" style={{ color: "var(--accent-ink)" }}>
                Recommended flow: Customer &rarr; KDS &rarr; Waiter &rarr; Admin
              </p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--accent-ink)", opacity: 0.7 }}>
                Place an order as a customer, then switch to Chef to see it arrive on the kitchen display.
              </p>
            </div>
          </section>
        </div>

        {/* ── Helpful Notes ─────────────────────────────── */}
        <section className="mt-8 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>!</span>
            <h2 className="font-serif text-lg font-bold" style={{ color: "var(--ink-900)" }}>Helpful <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Notes</em></h2>
          </div>
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {notes.map((n, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{n}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>Smart Restaurant OS &middot; Graduation Project &middot; {now.getFullYear()}</p>
        </footer>
      </div>
    </main>
  );
}
