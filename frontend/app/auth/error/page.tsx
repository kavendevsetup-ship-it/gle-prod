type AuthErrorPageProps = {
  searchParams?: {
    error?: string;
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "Authentication is temporarily unavailable due to a server configuration issue.",
  AccessDenied: "Access was denied. Please try signing in again.",
  Verification: "Verification failed. Please try again.",
};

export default function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const errorCode = searchParams?.error || "Configuration";
  const message =
    ERROR_MESSAGES[errorCode] ||
    "Authentication could not be completed. Please try again.";

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <section className="max-w-lg w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Sign-in Error</h1>
        <p className="mt-3 text-gray-600">{message}</p>
        <p className="mt-2 text-sm text-gray-500">Error code: {errorCode}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Go to Home
          </a>
          <a
            href="/api/auth/signin/google"
            className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Try Google Again
          </a>
        </div>
      </section>
    </main>
  );
}
