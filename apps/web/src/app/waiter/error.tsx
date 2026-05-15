"use client";

export default function WaiterError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <p className="text-4xl">⚠️</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-800">Dashboard Error</h1>
        <p className="mt-2 text-sm text-slate-500">{error.message}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
