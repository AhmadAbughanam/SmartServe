"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#f3f1ec] px-6" style={{ fontFamily: "system-ui, sans-serif" }}>
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
          <span className="text-5xl">⚠️</span>
          <h1 className="mt-4 text-xl font-bold" style={{ color: "#1a1f2e" }}>Something went wrong</h1>
          <p className="mt-2 text-sm" style={{ color: "#6b7280" }}>{error.message || "An unexpected error occurred."}</p>
          <button onClick={reset} className="mt-6 rounded-xl px-6 py-3 text-sm font-semibold text-white" style={{ background: "#d4581d" }}>Try Again</button>
        </div>
      </body>
    </html>
  );
}
