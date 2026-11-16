export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="mb-4 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          Pakistan Market Preview
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          ChargeShare
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Decentralized EV charging network for Pakistan. Homeowners monetize idle residential chargers; EV drivers find verified, reliable charging spots.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href="/api/v1/health"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            Check API Health
          </a>
          <a
            href="/admin"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Admin Panel
          </a>
        </div>
      </div>
    </main>
  );
}
