import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold tracking-tight">IPTV Panel</h1>
        <p className="mb-8 text-xl text-blue-200">
          B2B IPTV App Activation Reseller Panel
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold transition hover:bg-blue-700"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="rounded-lg border border-blue-400 px-8 py-3 text-lg font-semibold transition hover:bg-blue-800"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
