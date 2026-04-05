/**
 * Shared API URL utility
 * Single source of truth for backend API base URL.
 * Used by api.ts, cricketdata.ts, AuthContext.tsx, GoogleAuthButton.tsx
 */

/**
 * Get the backend API base URL (without trailing /api).
 * Priority:
 *  1. REACT_APP_API_URL env variable
 *  2. Production domain detection (window.location)
 *  3. Fallback to production domain
 */
export const getApiBaseUrl = (): string => {
  // 1. Environment variable always wins
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl) return envUrl;

  // 2. Client-side production domain detection
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    // Production domains
    if (
      hostname === 'grandleagueexpert.com' ||
      hostname === 'www.grandleagueexpert.com'
    ) {
      return 'https://www.grandleagueexpert.com';
    }

    // If served over HTTPS (e.g. staging), use same-origin
    if (protocol === 'https:') {
      return `https://${hostname}`;
    }
  }

  // 3. Default production domain
  return 'https://grandleagueexpert.com';
};

export default getApiBaseUrl;
