"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  createPaymentOrder,
  getMatchAccess,
  getMatchDetails,
  verifyPayment,
  type FreeContentApiItem,
  type MatchApiItem,
  type PremiumContentApiItem,
} from "@/services/api";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (response: unknown) => void) => void;
    };
  }
}

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type PremiumBlock =
  | { type: "heading"; text: string; highlight: boolean }
  | { type: "keyValue"; key: string; value: string; highlight: boolean }
  | { type: "list"; items: string[]; highlight: boolean }
  | { type: "paragraph"; text: string; highlight: boolean };

let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

function getFileNameFromUrl(fileUrl: string) {
  try {
    const parsed = new URL(fileUrl);
    const fileName = parsed.pathname.split("/").pop() || "file";
    return decodeURIComponent(fileName);
  } catch {
    const fileName = fileUrl.split("/").pop() || "file";
    return decodeURIComponent(fileName);
  }
}

function isImportantPremiumLine(line: string): boolean {
  return /(captain|vice\s*captain|gl\s*team|strategy)/i.test(line);
}

function formatPremiumContent(description: string): PremiumBlock[] {
  const normalized = (description || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: PremiumBlock[] = [];
  let bulletBuffer: string[] = [];
  let bulletHighlight = false;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;

    blocks.push({
      type: "list",
      items: [...bulletBuffer],
      highlight: bulletHighlight,
    });

    bulletBuffer = [];
    bulletHighlight = false;
  };

  const bulletRegex = /^([\-*•]|\d+[.)])\s+/;

  for (const line of lines) {
    const isBullet = bulletRegex.test(line);

    if (isBullet) {
      const itemText = line.replace(bulletRegex, "").trim();
      if (itemText) {
        bulletBuffer.push(itemText);
        bulletHighlight = bulletHighlight || isImportantPremiumLine(itemText);
      }
      continue;
    }

    flushBullets();

    const isHeading = /:$/.test(line);
    if (isHeading) {
      const headingText = line.slice(0, -1).trim();
      if (headingText) {
        blocks.push({
          type: "heading",
          text: headingText,
          highlight: isImportantPremiumLine(headingText),
        });
      }
      continue;
    }

    const colonIndex = line.indexOf(":");
    const looksLikeKeyValue =
      colonIndex > 0 &&
      colonIndex < line.length - 1 &&
      line.slice(0, colonIndex).trim().length <= 32;

    if (looksLikeKeyValue) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      blocks.push({
        type: "keyValue",
        key,
        value,
        highlight: isImportantPremiumLine(key) || isImportantPremiumLine(value),
      });
      continue;
    }

    blocks.push({
      type: "paragraph",
      text: line,
      highlight: isImportantPremiumLine(line),
    });
  }

  flushBullets();
  return blocks;
}

function FreeContentItem({ item }: { item: FreeContentApiItem }) {
  const isPdf = item.type === "pdf";
  const fileName = getFileNameFromUrl(item.file);

  return (
    <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 hover:shadow-craft-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              isPdf
                ? "bg-blue-100 text-blue-800 border-blue-200"
                : "bg-green-100 text-green-800 border-green-200"
            }`}
          >
            {item.type.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <p className="text-sm sm:text-base font-semibold text-gray-900">
          {isPdf ? "Free PDF Analysis" : "Free Match Image"}
        </p>
        <p className="text-xs sm:text-sm text-gray-600 break-all">{fileName}</p>
      </div>

      {isPdf ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <p className="text-xs sm:text-sm text-blue-800 font-medium">PDF ready to view or download</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <a
              href={item.file}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-primary text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 text-center"
            >
              Open PDF
            </a>
            <a
              href={item.file}
              download
              className="bg-white text-gray-900 border border-gray-200 py-2.5 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 text-center"
            >
              Download
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden shadow-md bg-white border border-gray-100">
            <img
              src={item.file}
              alt={fileName}
              className="w-full h-auto object-contain max-h-56 sm:max-h-64"
              loading="lazy"
            />
          </div>
          <a
            href={item.file}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-block bg-gradient-primary text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 text-center"
          >
            View Full Image
          </a>
        </div>
      )}
    </div>
  );
}

function PremiumContentItem({ item }: { item: PremiumContentApiItem }) {
  const blocks = formatPremiumContent(item.description);

  const baseBlockClass =
    "rounded-xl border px-4 py-3 sm:px-5 sm:py-4 break-words max-w-full";
  const plainBlockClass = `${baseBlockClass} border-gray-100/80 bg-white/75`;
  const highlightBlockClass =
    `${baseBlockClass} border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50`;

  return (
    <div className="bg-gradient-card/95 backdrop-blur-sm rounded-2xl border border-gray-200/70 p-5 sm:p-6 shadow-lg hover:shadow-craft-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-200">
            KAIRO
          </span>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-5">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight tracking-tight">
          {item.title}
        </h3>

        <div className="space-y-3 text-sm sm:text-base text-gray-800 leading-relaxed">
          {blocks.length > 0 ? (
            blocks.map((block, index) => {
              const wrapperClass = block.highlight ? highlightBlockClass : plainBlockClass;

              if (block.type === "heading") {
                return (
                  <div key={`${item.id}-heading-${index}`} className={wrapperClass}>
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900">{block.text}</h4>
                  </div>
                );
              }

              if (block.type === "keyValue") {
                return (
                  <div key={`${item.id}-kv-${index}`} className={wrapperClass}>
                    <p className="text-sm sm:text-base leading-relaxed text-gray-800">
                      <span className="font-semibold text-gray-900">{block.key}: </span>
                      <span>{block.value}</span>
                    </p>
                  </div>
                );
              }

              if (block.type === "list") {
                return (
                  <div key={`${item.id}-list-${index}`} className={wrapperClass}>
                    <ul className="space-y-2 pl-5 list-disc marker:text-amber-600 text-sm sm:text-base leading-relaxed">
                      {block.items.map((listItem, itemIndex) => (
                        <li key={`${item.id}-list-item-${index}-${itemIndex}`} className="text-gray-800">
                          {listItem}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }

              return (
                <div key={`${item.id}-paragraph-${index}`} className={wrapperClass}>
                  <p className="text-sm sm:text-base leading-relaxed text-gray-800">{block.text}</p>
                </div>
              );
            })
          ) : (
            <div className={plainBlockClass}>
              <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                {item.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 px-4 py-3">
        <p className="text-xs sm:text-sm font-medium text-amber-800">Included in your premium access</p>
      </div>
    </div>
  );
}

export default function MatchDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const matchId = params?.id;

  const [match, setMatch] = useState<MatchApiItem | null>(null);
  const [freeContent, setFreeContent] = useState<FreeContentApiItem[]>([]);
  const [premiumContent, setPremiumContent] = useState<PremiumContentApiItem[]>([]);
  const [access, setAccess] = useState(false);
  const [isSubscriptionAccess, setIsSubscriptionAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAccess = async (targetMatchId: number | string) => {
    const accessResult = await getMatchAccess(targetMatchId);
    setAccess(!!(accessResult.has_access ?? accessResult.access));
    setIsSubscriptionAccess(!!accessResult.is_subscription);
  };

  const initiatePayment = async (
    planType: "match" | "subscription",
    matchIdToUnlock?: number,
    matchName?: string
  ) => {
    try {
      setError(null);

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        alert("Unable to load payment gateway. Please try again.");
        return;
      }

      const order = await createPaymentOrder(
        planType === "match"
          ? { type: "match", match_id: matchIdToUnlock }
          : { type: "subscription" }
      );
      const razorpayKey = order.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        alert("Unable to load payment gateway. Please try again.");
        return;
      }

      const options: Record<string, unknown> = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "Grand League Expert",
        description:
          planType === "subscription" ? "Monthly KAIRO Access" : matchName,
        handler: async (response: RazorpayHandlerResponse) => {
          try {
            const verify = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: planType,
              ...(planType === "match" && matchIdToUnlock
                ? { match_id: matchIdToUnlock }
                : {}),
            });

            if (verify.success) {
              if (matchId) {
                await refreshAccess(matchId);
              }
              setIsSubscriptionAccess(!!verify.is_subscription);
            } else {
              setError("Verification failed");
              alert("Verification failed");
            }
          } catch {
            setError("Verification failed");
            alert("Verification failed");
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        alert("Payment failed");
      });
      rzp.open();
    } catch (paymentError) {
      const message =
        paymentError instanceof Error ? paymentError.message : "Unable to start payment.";

      if (message === "AUTH_REQUIRED") {
        alert("Please login to continue.");
        window.location.href = "/";
        return;
      }

      setError(message);
      alert(message);
    }
  };

  const handleUnlockPremium = async () => {
    if (!match) {
      alert("Match details are not available right now.");
      return;
    }

    await initiatePayment("match", match.id, match.match_name);
  };

  const handleUnlockSubscription = async () => {
    await initiatePayment("subscription");
  };

  useEffect(() => {
    if (!matchId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [details, accessResult] = await Promise.all([
          getMatchDetails(matchId),
          getMatchAccess(matchId),
        ]);

        setMatch(details.match);
        setFreeContent(details.free_content || []);
        setPremiumContent(details.premium_content || []);
        setAccess(!!(accessResult.has_access ?? accessResult.access));
        setIsSubscriptionAccess(!!accessResult.is_subscription);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load match data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [matchId]);

  const dateTime = match ? formatDateTime(match.match_date) : null;

  return (
    <div className="min-h-screen bg-gradient-radial overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 sm:pb-20">
        <div className="sticky top-4 z-30 mb-6 sm:mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200/70 bg-white/70 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
          >
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </button>
        </div>

        <div className="text-center mb-10 sm:mb-12 md:mb-14">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6 lg:mb-8 px-2 sm:px-4 md:px-6 lg:px-8">
            {match?.match_name || "Match Details"}
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 max-w-2xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
            {match ? `${match.team_1} vs ${match.team_2} • ${dateTime?.date} ${dateTime?.time}` : "Loading match..."}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-600">Loading match content...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">Failed to load match data. Please try again.</div>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">KAIRO Analysis &amp; KAIRO Teams</h2>
                <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-gradient-primary text-white shadow-lg">
                  {access ? (isSubscriptionAccess ? "Monthly ✅" : "Unlocked ✅") : "KAIRO"}
                </span>
              </div>

              {access ? (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                  {premiumContent.length > 0 ? (
                    premiumContent.map((item) => <PremiumContentItem key={item.id} item={item} />)
                  ) : (
                    <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 text-gray-600">
                      No premium content available.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 relative rounded-2xl min-h-[26rem] sm:min-h-[28rem]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 blur-[2.5px] select-none pointer-events-none p-1">
                    {premiumContent.length > 0
                      ? premiumContent.map((item) => <PremiumContentItem key={item.id} item={item} />)
                      : [1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 hover:shadow-craft-lg transition-all duration-300"
                          >
                            <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
                            <div className="h-3 w-full bg-gray-200 rounded mb-2" />
                            <div className="h-3 w-5/6 bg-gray-200 rounded" />
                          </div>
                        ))}
                  </div>

                  <div className="absolute inset-0 rounded-2xl bg-white/50 backdrop-blur-[1.5px] flex items-center justify-center p-4 sm:p-6">
                    <div className="w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-orange-50 border border-orange-200/70 shadow-2xl p-6 sm:p-8 text-center">
                      <p className="text-sm sm:text-base font-semibold text-orange-700 mb-2">Advanced Analysis Locked</p>
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-3">Unlock KAIRO Analysis & Teams</h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-6">
                        Unlock captain picks, differential teams, and advanced analysis.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={handleUnlockPremium}
                          className="w-full bg-gradient-primary text-white py-3 sm:py-4 px-6 rounded-xl text-base sm:text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5"
                        >
                          Unlock Match ₹99
                        </button>
                        <button
                          onClick={handleUnlockSubscription}
                          className="w-full bg-white text-gray-900 border border-gray-200 py-3 sm:py-4 px-6 rounded-xl text-base sm:text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5"
                        >
                          Monthly ₹999
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="mt-12 sm:mt-14 md:mt-16">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Match Analysis &amp; GL Team</h2>
                <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-green-100 text-green-700 border border-green-200">
                  GL Analysis
                </span>
              </div>

              <div className="flex flex-col gap-4 sm:gap-6">
                {freeContent.length > 0 ? (
                  freeContent.map((item) => <FreeContentItem key={item.id} item={item} />)
                ) : (
                  <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 text-gray-600">
                    No free content available.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
