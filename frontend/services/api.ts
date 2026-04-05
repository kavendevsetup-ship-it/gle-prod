export type MatchApiItem = {
  id: number;
  team_1: string;
  team_2: string;
  match_name: string;
  match_date: string;
};

export type FreeContentApiItem = {
  id: number;
  type: "pdf" | "image";
  file: string;
};

export type PremiumContentApiItem = {
  id: number;
  title: string;
  description: string;
};

export type MatchDetailApiResponse = {
  match: MatchApiItem;
  free_content: FreeContentApiItem[];
  premium_content: PremiumContentApiItem[];
};

export type MatchAccessApiResponse = {
  access: boolean;
};

export type CreateOrderResponse = {
  order_id: string;
  amount: number;
  currency: string;
  key: string;
};

export type VerifyPaymentPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  match_id: number;
};

export type VerifyPaymentResponse = {
  success: boolean;
};

export type BackendAuthBridgePayload = {
  email: string;
  name?: string;
};

export type BackendAuthBridgeResponse = {
  token: string;
  user: {
    id: number;
    email: string;
    username: string;
  };
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://grandleagueexpert.com/api/";

function buildApiUrl(path: string): string {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${normalizedPath}`;
}

function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export async function bridgeBackendAuth(
  payload: BackendAuthBridgePayload
): Promise<BackendAuthBridgeResponse> {
  const response = await fetch(buildApiUrl("backend-auth/google/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to bridge auth (${response.status})`);
  }

  return (await response.json()) as BackendAuthBridgeResponse;
}

export async function fetchMatches(): Promise<MatchApiItem[]> {
  const response = await fetch(buildApiUrl("matches/"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch matches (${response.status})`);
  }

  const data = (await response.json()) as MatchApiItem[];
  return Array.isArray(data) ? data : [];
}

export async function getMatchDetails(
  id: number | string
): Promise<MatchDetailApiResponse> {
  const response = await fetch(buildApiUrl(`match/${id}/`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch match details (${response.status})`);
  }

  return (await response.json()) as MatchDetailApiResponse;
}

export async function getMatchAccess(
  id: number | string
): Promise<MatchAccessApiResponse> {
  const token = getStoredAuthToken();
  if (!token) {
    return { access: false };
  }

  const response = await fetch(buildApiUrl(`match/${id}/access/`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    return { access: false };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch match access (${response.status})`);
  }

  return (await response.json()) as MatchAccessApiResponse;
}

export async function createPaymentOrder(
  matchId: number
): Promise<CreateOrderResponse> {
  if (typeof window === "undefined") {
    throw new Error("Payment is only available in browser context");
  }

  const token = getStoredAuthToken();
  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch(buildApiUrl("payment/create-order/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ match_id: matchId }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!response.ok) {
    throw new Error(`Failed to create order (${response.status})`);
  }

  return (await response.json()) as CreateOrderResponse;
}

export async function verifyPayment(
  payload: VerifyPaymentPayload
): Promise<VerifyPaymentResponse> {
  if (typeof window === "undefined") {
    throw new Error("Payment is only available in browser context");
  }

  const token = getStoredAuthToken();
  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch(buildApiUrl("payment/verify/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!response.ok) {
    throw new Error(`Failed to verify payment (${response.status})`);
  }

  return (await response.json()) as VerifyPaymentResponse;
}
