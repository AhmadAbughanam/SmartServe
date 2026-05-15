import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-float">
        <span className="text-6xl">🔍</span>
        <h1 className="mt-4 text-2xl font-bold text-brand-ink">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-brand-ember px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-ember/20 transition hover:-translate-y-0.5">
          Go Home
        </Link>
      </div>
    </main>
  );
}
