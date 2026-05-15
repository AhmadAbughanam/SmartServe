"use client";

export default function KitchenError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-6">
      <div className="max-w-md rounded-2xl bg-slate-800 p-8 text-center shadow-2xl">
        <p className="text-4xl">⚠️</p>
        <h1 className="mt-3 text-2xl font-bold text-white">KDS Error</h1>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-xl bg-orange-500 px-6 py-3 font-bold text-white hover:bg-orange-400"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
