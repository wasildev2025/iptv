export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left: Red branded panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-red-600 via-red-700 to-red-900 p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur text-2xl font-bold">
              IB
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">IPTV Panel</h1>
              <p className="text-sm text-red-200">Reseller Dashboard</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold mb-4">
            Manage your IPTV activations with ease
          </h2>
          <ul className="space-y-3 text-red-100">
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
              Activate devices across 20+ IPTV apps
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
              Manage sub-resellers with profit margins
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
              Track credits, playlists, and billing in one place
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-300" />
              Real-time analytics and activity monitoring
            </li>
          </ul>
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
