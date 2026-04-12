"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  createPaymentOrder,
  getPricing,
  getMatchAccess,
  getMatchDetails,
  type PaymentPlanType,
  type PricingApiResponse,
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

type GalleryImageItem = {
  id: number;
  file: string;
  label: string;
};

type PdfDocumentItem = {
  id: number;
  url: string;
  label: string;
};

type PremiumVideoItem = PremiumContentApiItem & {
  video: string;
};

const FALLBACK_PRICING: PricingApiResponse = {
  match_price: 39,
  weekly_price: 129,
  weekly_original_price: 199,
  monthly_price: 499,
  monthly_original_price: 499,
  enable_weekly: true,
  enable_monthly: true,
  enable_match: false,
  enable_match_plan: false,
  weekly_offer_active: true,
  monthly_offer_active: false,
};

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

function resolvePremiumContentType(item: PremiumContentApiItem): "text" | "image" | "video" {
  if (item.content_type === "video") return "video";
  if (item.content_type === "image") return "image";
  if (item.content_type === "text") return "text";
  if (item.video) return "video";
  if (item.image) return "image";
  return "text";
}

function resolveFreeContentType(item: FreeContentApiItem): "pdf" | "image" | "text" {
  const explicitType = (item.content_type || item.type || "pdf").toLowerCase();
  if (explicitType === "pdf" || explicitType === "image" || explicitType === "text") {
    return explicitType;
  }

  if ((item.text_body || item.text_title || "").trim()) return "text";
  return "pdf";
}

function FreePdfAnalysisCard({ pdfCount, onOpen }: { pdfCount: number; onOpen: () => void }) {
  return (
    <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 hover:shadow-craft-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-100 text-blue-800 border-blue-200">
            PDF
          </span>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <p className="text-sm sm:text-base font-semibold text-gray-900">Match Reports</p>
        <p className="text-xs sm:text-sm text-gray-600">
          {pdfCount > 1 ? `${pdfCount} PDF reports available` : "1 PDF report available"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
          <p className="text-xs sm:text-sm text-blue-800 font-medium">Secure in-app PDF viewing. No external redirect.</p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="w-full inline-block bg-gradient-primary text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 text-center"
        >
          View Analysis
        </button>
      </div>
    </div>
  );
}

function FreeTextReportCard({ textCount, onOpen }: { textCount: number; onOpen: () => void }) {
  return (
    <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 hover:shadow-craft-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium border bg-emerald-100 text-emerald-800 border-emerald-200">
            TEXT
          </span>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <p className="text-sm sm:text-base font-semibold text-gray-900">Text Report</p>
        <p className="text-xs sm:text-sm text-gray-600">
          {textCount > 1 ? `${textCount} analysis notes available` : "1 analysis note available"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="text-xs sm:text-sm text-emerald-800 font-medium">Structured free text insights with clean readability.</p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="w-full inline-block bg-gradient-primary text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 text-center"
        >
          View Analysis
        </button>
      </div>
    </div>
  );
}

function FreeTextContentItem({ item }: { item: FreeContentApiItem }) {
  const title = (item.text_title || "Free Analysis").trim();
  const body = (item.text_body || "").trim();
  const blocks = formatPremiumContent(body);

  return (
    <div className="bg-gradient-card/95 rounded-2xl border border-gray-200/70 p-5 sm:p-6 shadow-lg">
      <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">{title}</h4>

      <div className="space-y-3 text-sm sm:text-base text-gray-800 leading-relaxed">
        {blocks.length > 0 ? (
          blocks.map((block, index) => {
            if (block.type === "heading") {
              return (
                <div key={`${item.id}-free-heading-${index}`} className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3">
                  <h5 className="font-semibold text-gray-900">{block.text}</h5>
                </div>
              );
            }

            if (block.type === "keyValue") {
              return (
                <div key={`${item.id}-free-kv-${index}`} className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3">
                  <p>
                    <span className="font-semibold text-gray-900">{block.key}: </span>
                    <span>{block.value}</span>
                  </p>
                </div>
              );
            }

            if (block.type === "list") {
              return (
                <div key={`${item.id}-free-list-${index}`} className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3">
                  <ul className="space-y-2 pl-5 list-disc marker:text-emerald-600">
                    {block.items.map((listItem, itemIndex) => (
                      <li key={`${item.id}-free-list-item-${index}-${itemIndex}`}>{listItem}</li>
                    ))}
                  </ul>
                </div>
              );
            }

            return (
              <div key={`${item.id}-free-paragraph-${index}`} className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3">
                <p>{block.text}</p>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3">
            <p>{body}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FreeTextContentModal({
  isOpen,
  items,
  onClose,
}: {
  isOpen: boolean;
  items: FreeContentApiItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[121] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-emerald-700 font-semibold">📝 Text Report</p>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Free Match Analysis</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 bg-white text-gray-700 w-9 h-9 flex items-center justify-center hover:bg-gray-50"
            aria-label="Close text report"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-84px)] p-4 sm:p-6 space-y-4 sm:space-y-5">
          {items.map((item) => (
            <FreeTextContentItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PdfViewerModal({
  isOpen,
  documents,
  activeIndex,
  onClose,
  onPrev,
  onNext,
  onSetIndex,
}: {
  isOpen: boolean;
  documents: PdfDocumentItem[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSetIndex: (index: number) => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, onNext, onPrev]);

  if (!isOpen || documents.length === 0) return null;

  const activeDoc = documents[activeIndex];
  const pdfSrc = `${activeDoc.url}#toolbar=0&navpanes=0&statusbar=0`;

  return (
    <div
      className="fixed inset-0 z-[122] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="relative w-full max-w-5xl h-[82vh] rounded-2xl border border-white/20 bg-white shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 rounded-full bg-white text-gray-900 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label="Close PDF viewer"
        >
          ✕
        </button>

        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 px-3 py-1.5 rounded-full bg-gray-900/85 text-white text-xs sm:text-sm font-medium">
          PDF Analysis • {activeIndex + 1} / {documents.length}
        </div>

        <div className="h-full pt-14 sm:pt-16 pb-14 sm:pb-16 px-2 sm:px-3">
          <object
            key={activeDoc.id}
            data={pdfSrc}
            type="application/pdf"
            className="w-full h-full rounded-lg bg-white"
          >
            <div className="h-full w-full flex items-center justify-center px-6 text-center">
              <div className="max-w-sm">
                <p className="text-sm text-gray-700 mb-3">Unable to preview this PDF in the embedded viewer.</p>
                <a
                  href={activeDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center bg-gradient-primary text-white py-2 px-4 rounded-lg text-sm font-medium"
                >
                  Open PDF
                </a>
              </div>
            </div>
          </object>
        </div>

        <div className="absolute bottom-0 inset-x-0 bg-white/95 border-t border-gray-200 px-4 sm:px-6 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onPrev}
              className="bg-white text-gray-900 border border-gray-200 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={onNext}
              className="bg-white text-gray-900 border border-gray-200 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50"
            >
              Next
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gradient-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:shadow-lg"
            >
              Close
            </button>
          </div>

          {documents.length > 1 ? (
            <div className="mt-3 flex justify-center gap-2">
              {documents.map((doc, index) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onSetIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    index === activeIndex ? "w-6 bg-gray-900" : "w-2 bg-gray-400"
                  }`}
                  aria-label={`Go to PDF ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GLAnalysisCard({ imageCount, onOpen }: { imageCount: number; onOpen: () => void }) {
  return (
    <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 hover:shadow-craft-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
            IMAGE
          </span>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <p className="text-sm sm:text-base font-semibold text-gray-900">GL Analysis</p>
        <p className="text-xs sm:text-sm text-gray-600">
          {imageCount > 1 ? `${imageCount} analysis images available` : "1 analysis image available"}
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-green-100 bg-green-50/60 p-3">
          <p className="text-xs sm:text-sm text-green-800 font-medium">Swipe or use arrows to browse all analysis images</p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="w-full inline-block bg-gradient-primary text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 text-center"
        >
          View GL Analysis
        </button>
      </div>
    </div>
  );
}

function ImageViewerModal({
  isOpen,
  images,
  activeIndex,
  title,
  onClose,
  onPrev,
  onNext,
  onSetIndex,
}: {
  isOpen: boolean;
  images: GalleryImageItem[];
  activeIndex: number;
  title: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSetIndex: (index: number) => void;
}) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft") {
        onPrev();
      }
      if (event.key === "ArrowRight") {
        onNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, onNext, onPrev]);

  if (!isOpen || images.length === 0) return null;

  const activeImage = images[activeIndex];

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-5xl rounded-2xl border border-white/20 bg-black/40 shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 rounded-full bg-white/90 text-gray-900 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Close gallery"
        >
          ✕
        </button>

        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 px-3 py-1.5 rounded-full bg-black/55 text-white text-xs sm:text-sm font-medium">
          {title} • {activeIndex + 1} / {images.length}
        </div>

        <div
          className="relative flex items-center justify-center min-h-[58vh] sm:min-h-[66vh] px-2 sm:px-12 py-12 sm:py-14"
          onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
          onTouchEnd={(event) => {
            if (touchStartX === null) return;
            const endX = event.changedTouches[0]?.clientX ?? touchStartX;
            const delta = endX - touchStartX;
            if (delta > 40) onPrev();
            if (delta < -40) onNext();
            setTouchStartX(null);
          }}
        >
          <button
            type="button"
            onClick={onPrev}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/85 text-gray-900 items-center justify-center hover:bg-white transition-colors"
            aria-label="Previous image"
          >
            ‹
          </button>

          <img
            key={activeImage.id}
            src={activeImage.file}
            alt={`${activeImage.label} ${activeIndex + 1}`}
            className="w-full h-full max-h-[60vh] sm:max-h-[70vh] object-contain rounded-xl transition-opacity duration-300"
            loading="eager"
          />

          <button
            type="button"
            onClick={onNext}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/85 text-gray-900 items-center justify-center hover:bg-white transition-colors"
            aria-label="Next image"
          >
            ›
          </button>
        </div>

        <div className="sm:hidden grid grid-cols-2 gap-2 px-3 pb-3">
          <button
            type="button"
            onClick={onPrev}
            className="bg-white/90 text-gray-900 py-2 rounded-lg text-sm font-medium"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            className="bg-white/90 text-gray-900 py-2 rounded-lg text-sm font-medium"
          >
            Next
          </button>
        </div>

        {images.length > 1 ? (
          <div className="px-4 pb-4 sm:px-6 sm:pb-5 flex justify-center gap-1.5 sm:gap-2">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onSetIndex(index)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/45"
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}


function PremiumContentCard({
  icon,
  title,
  description,
  ctaLabel,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="bg-gradient-card rounded-2xl border border-gray-200/60 p-5 sm:p-6 shadow-md hover:shadow-craft-lg transition-all duration-300">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-lg" aria-hidden="true">{icon}</span>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">{description}</p>
      <button
        type="button"
        onClick={onClick}
        className="w-full inline-block bg-gradient-primary text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200 text-center"
      >
        {ctaLabel}
      </button>
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

function TextContentModal({
  isOpen,
  items,
  onClose,
}: {
  isOpen: boolean;
  items: PremiumContentApiItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[125] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-amber-700 font-semibold">📝 Text Content</p>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Premium Match Analysis</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 bg-white text-gray-700 w-9 h-9 flex items-center justify-center hover:bg-gray-50"
            aria-label="Close text analysis"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-84px)] p-4 sm:p-6 space-y-4 sm:space-y-5">
          {items.map((item) => (
            <PremiumContentItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoContentModal({
  isOpen,
  videos,
  activeIndex,
  onClose,
  onPrev,
  onNext,
  onSetIndex,
}: {
  isOpen: boolean;
  videos: PremiumVideoItem[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSetIndex: (index: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
      if (event.key === " ") {
        event.preventDefault();
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
          video.play();
          setIsPlaying(true);
        } else {
          video.pause();
          setIsPlaying(false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, onNext, onPrev]);

  useEffect(() => {
    setIsPlaying(false);
  }, [activeIndex]);

  if (!isOpen || videos.length === 0) return null;

  const activeVideo = videos[activeIndex];

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const openFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await video.requestFullscreen();
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="relative w-full max-w-5xl rounded-2xl border border-white/20 bg-black/40 shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 rounded-full bg-white/90 text-gray-900 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Close video analysis"
        >
          ✕
        </button>

        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 px-3 py-1.5 rounded-full bg-black/55 text-white text-xs sm:text-sm font-medium">
          🎥 Video Content • {activeIndex + 1} / {videos.length}
        </div>

        <div className="relative flex items-center justify-center min-h-[55vh] sm:min-h-[64vh] px-2 sm:px-12 py-12 sm:py-14">
          <video
            key={activeVideo.id}
            ref={videoRef}
            src={activeVideo.video}
            className="w-full h-full max-h-[60vh] sm:max-h-[70vh] object-contain rounded-xl"
            controls={false}
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            playsInline
            onContextMenu={(event) => event.preventDefault()}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {videos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={onPrev}
                className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/85 text-gray-900 items-center justify-center hover:bg-white transition-colors"
                aria-label="Previous video"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={onNext}
                className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/85 text-gray-900 items-center justify-center hover:bg-white transition-colors"
                aria-label="Next video"
              >
                ›
              </button>
            </>
          ) : null}
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <p className="text-white/85 text-sm mb-3 font-medium leading-relaxed">{activeVideo.title || "KAIRO Video Analysis"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className="bg-white text-gray-900 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-100"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={openFullscreen}
              className="bg-white text-gray-900 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-100"
            >
              Fullscreen
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gradient-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:shadow-lg"
            >
              Close
            </button>
          </div>
          <p className="mt-3 text-xs text-white/65">Streaming enabled. Download and right-click options are restricted.</p>

          {videos.length > 1 ? (
            <div className="mt-3 flex justify-center gap-2">
              {videos.map((video, index) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => onSetIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/45"
                  }`}
                  aria-label={`Go to video ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LockedPremiumPreviewCards() {
  const cards = [
    { id: "text", icon: "📝", title: "Text Content", action: "View Analysis" },
    { id: "image", icon: "🖼️", title: "Image Content", action: "View Analysis" },
    { id: "video", icon: "🎥", title: "Video Content", action: "Watch Analysis" },
  ];

  return (
    <div className="relative rounded-2xl border border-gray-200/60 bg-white/55 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 select-none pointer-events-none blur-[6px] opacity-45">
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <p className="text-lg mb-2" aria-hidden="true">{card.icon}</p>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{card.title}</h4>
            <p className="text-xs text-gray-600 mb-3">Premium match analysis</p>
            <button type="button" className="w-full rounded-lg bg-gray-200 text-gray-700 text-xs font-medium py-2">
              {card.action}
            </button>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/45 to-white/85" />
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
  const [isFreeTextModalOpen, setIsFreeTextModalOpen] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const [isFreeImageViewerOpen, setIsFreeImageViewerOpen] = useState(false);
  const [activeFreeImageIndex, setActiveFreeImageIndex] = useState(0);
  const [isTextContentModalOpen, setIsTextContentModalOpen] = useState(false);
  const [isPremiumImageViewerOpen, setIsPremiumImageViewerOpen] = useState(false);
  const [activePremiumImageIndex, setActivePremiumImageIndex] = useState(0);
  const [isVideoContentModalOpen, setIsVideoContentModalOpen] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [pricing, setPricing] = useState<PricingApiResponse>(FALLBACK_PRICING);
  const ENABLE_WEEKLY_PLAN = pricing.enable_weekly ?? FALLBACK_PRICING.enable_weekly ?? true;
  const ENABLE_MONTHLY_PLAN = pricing.enable_monthly ?? FALLBACK_PRICING.enable_monthly ?? true;
  const ENABLE_MATCH_PLAN =
    pricing.enable_match ?? pricing.enable_match_plan ?? FALLBACK_PRICING.enable_match ?? false;
  const WEEKLY_OFFER_ACTIVE =
    pricing.weekly_offer_active ?? FALLBACK_PRICING.weekly_offer_active ?? true;
  const MONTHLY_OFFER_ACTIVE =
    pricing.monthly_offer_active ?? FALLBACK_PRICING.monthly_offer_active ?? false;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const freeTextContent = freeContent.filter((item) => {
    const contentType = resolveFreeContentType(item);
    const hasText = Boolean((item.text_title || "").trim() || (item.text_body || "").trim());
    return contentType === "text" && hasText;
  });

  const freePdfContent = freeContent.filter(
    (item) => resolveFreeContentType(item) === "pdf" && Boolean(item.file)
  );

  const freePdfDocuments: PdfDocumentItem[] = freePdfContent.map((item, index) => ({
    id: item.id,
    url: `/api/free-content/pdf/${item.id}/`,
    label: item.text_title || `Match Report ${index + 1}`,
  }));

  const freeImageContent = freeContent.filter(
    (item) => resolveFreeContentType(item) === "image" && Boolean(item.file)
  );

  const freeImageGallery: GalleryImageItem[] = freeImageContent.map((item) => ({
    id: item.id,
    file: item.file as string,
    label: "GL Analysis",
  }));

  const premiumTextContent = premiumContent.filter((item) => {
    const contentType = resolvePremiumContentType(item);
    const hasText = Boolean((item.title || "").trim() || (item.description || "").trim());
    return contentType === "text" && hasText;
  });

  const premiumImageGallery: GalleryImageItem[] = premiumContent
    .filter((item) => resolvePremiumContentType(item) === "image" && Boolean(item.image))
    .map((item) => ({
      id: item.id,
      file: item.image as string,
      label: item.title || "KAIRO Visual Analysis",
    }));

  const premiumVideoContent: PremiumVideoItem[] = premiumContent
    .filter((item) => resolvePremiumContentType(item) === "video" && Boolean(item.video))
    .map((item) => ({
      ...item,
      video: item.video as string,
    }));

  const openFreeTextModal = () => {
    if (freeTextContent.length === 0) return;
    setIsFreeTextModalOpen(true);
  };

  const closeFreeTextModal = () => {
    setIsFreeTextModalOpen(false);
  };

  const openPdfViewer = () => {
    if (freePdfDocuments.length === 0) return;
    setActivePdfIndex(0);
    setIsPdfViewerOpen(true);
  };

  const closePdfViewer = () => {
    setIsPdfViewerOpen(false);
  };

  const showPreviousPdf = () => {
    setActivePdfIndex((prev) => {
      if (freePdfDocuments.length === 0) return 0;
      return prev === 0 ? freePdfDocuments.length - 1 : prev - 1;
    });
  };

  const showNextPdf = () => {
    setActivePdfIndex((prev) => {
      if (freePdfDocuments.length === 0) return 0;
      return prev === freePdfDocuments.length - 1 ? 0 : prev + 1;
    });
  };

  const openFreeImageViewer = () => {
    if (freeImageGallery.length === 0) return;
    setActiveFreeImageIndex(0);
    setIsFreeImageViewerOpen(true);
  };

  const closeFreeImageViewer = () => {
    setIsFreeImageViewerOpen(false);
  };

  const openTextContentModal = () => {
    if (premiumTextContent.length === 0) return;
    setIsTextContentModalOpen(true);
  };

  const closeTextContentModal = () => {
    setIsTextContentModalOpen(false);
  };

  const showPreviousFreeImage = () => {
    setActiveFreeImageIndex((prev) => {
      if (freeImageGallery.length === 0) return 0;
      return prev === 0 ? freeImageGallery.length - 1 : prev - 1;
    });
  };

  const showNextFreeImage = () => {
    setActiveFreeImageIndex((prev) => {
      if (freeImageGallery.length === 0) return 0;
      return prev === freeImageGallery.length - 1 ? 0 : prev + 1;
    });
  };

  const openPremiumImageViewer = () => {
    if (premiumImageGallery.length === 0) return;
    setActivePremiumImageIndex(0);
    setIsPremiumImageViewerOpen(true);
  };

  const closePremiumImageViewer = () => {
    setIsPremiumImageViewerOpen(false);
  };

  const openVideoContentModal = () => {
    if (premiumVideoContent.length === 0) return;
    setActiveVideoIndex(0);
    setIsVideoContentModalOpen(true);
  };

  const closeVideoContentModal = () => {
    setIsVideoContentModalOpen(false);
  };

  const showPreviousVideo = () => {
    setActiveVideoIndex((prev) => {
      if (premiumVideoContent.length === 0) return 0;
      return prev === 0 ? premiumVideoContent.length - 1 : prev - 1;
    });
  };

  const showNextVideo = () => {
    setActiveVideoIndex((prev) => {
      if (premiumVideoContent.length === 0) return 0;
      return prev === premiumVideoContent.length - 1 ? 0 : prev + 1;
    });
  };

  const showPreviousPremiumImage = () => {
    setActivePremiumImageIndex((prev) => {
      if (premiumImageGallery.length === 0) return 0;
      return prev === 0 ? premiumImageGallery.length - 1 : prev - 1;
    });
  };

  const showNextPremiumImage = () => {
    setActivePremiumImageIndex((prev) => {
      if (premiumImageGallery.length === 0) return 0;
      return prev === premiumImageGallery.length - 1 ? 0 : prev + 1;
    });
  };

  const refreshAccess = async (targetMatchId: number | string) => {
    const accessResult = await getMatchAccess(targetMatchId);
    const hasAccess = !!(accessResult.has_access ?? accessResult.access);
    setAccess(hasAccess);
    setIsSubscriptionAccess(!!accessResult.is_subscription);

    if (hasAccess) {
      const details = await getMatchDetails(targetMatchId);
      setPremiumContent(details.premium_content || []);
    }
  };

  const initiatePayment = async (
    planType: PaymentPlanType,
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
          : { type: planType }
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
          planType === "weekly"
            ? "Weekly KAIRO Access"
            : planType === "subscription"
              ? "Monthly KAIRO Access"
              : matchName,
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

  const handleUnlockWeekly = async () => {
    await initiatePayment("weekly");
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

        const [details, accessResult, pricingResult] = await Promise.all([
          getMatchDetails(matchId),
          getMatchAccess(matchId),
          getPricing().catch(() => FALLBACK_PRICING),
        ]);

        setMatch(details.match);
        setFreeContent(details.free_content || []);
        setPremiumContent(details.premium_content || []);
        setAccess(!!(accessResult.has_access ?? accessResult.access));
        setIsSubscriptionAccess(!!accessResult.is_subscription);
        setPricing({
          match_price:
            Number.isFinite(pricingResult.match_price) && pricingResult.match_price > 0
              ? pricingResult.match_price
              : FALLBACK_PRICING.match_price,
          weekly_price:
            Number.isFinite(pricingResult.weekly_price) && (pricingResult.weekly_price ?? 0) > 0
              ? pricingResult.weekly_price
              : FALLBACK_PRICING.weekly_price,
          weekly_original_price:
            Number.isFinite(pricingResult.weekly_original_price) && (pricingResult.weekly_original_price ?? 0) > 0
              ? pricingResult.weekly_original_price
              : FALLBACK_PRICING.weekly_original_price,
          monthly_price:
            Number.isFinite(pricingResult.monthly_price) && pricingResult.monthly_price > 0
              ? pricingResult.monthly_price
              : FALLBACK_PRICING.monthly_price,
          monthly_original_price:
            Number.isFinite(pricingResult.monthly_original_price) && (pricingResult.monthly_original_price ?? 0) > 0
              ? pricingResult.monthly_original_price
              : FALLBACK_PRICING.monthly_original_price,
          enable_weekly:
            typeof pricingResult.enable_weekly === "boolean"
              ? pricingResult.enable_weekly
              : FALLBACK_PRICING.enable_weekly,
          enable_monthly:
            typeof pricingResult.enable_monthly === "boolean"
              ? pricingResult.enable_monthly
              : FALLBACK_PRICING.enable_monthly,
          enable_match:
            typeof pricingResult.enable_match === "boolean"
              ? pricingResult.enable_match
              : FALLBACK_PRICING.enable_match,
          enable_match_plan:
            typeof pricingResult.enable_match_plan === "boolean"
              ? pricingResult.enable_match_plan
              : FALLBACK_PRICING.enable_match_plan,
          weekly_offer_active:
            typeof pricingResult.weekly_offer_active === "boolean"
              ? pricingResult.weekly_offer_active
              : FALLBACK_PRICING.weekly_offer_active,
          monthly_offer_active:
            typeof pricingResult.monthly_offer_active === "boolean"
              ? pricingResult.monthly_offer_active
              : FALLBACK_PRICING.monthly_offer_active,
        });
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
                  {access ? (isSubscriptionAccess ? "Subscribed ✅" : "Unlocked ✅") : "KAIRO"}
                </span>
              </div>

              {access ? (
                <div className="mt-2 space-y-4 sm:space-y-6">
                  {premiumTextContent.length > 0 || premiumImageGallery.length > 0 || premiumVideoContent.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {premiumTextContent.length > 0 ? (
                        <PremiumContentCard
                          icon="📝"
                          title="Text Content"
                          description={`${premiumTextContent.length} premium analysis section${premiumTextContent.length > 1 ? "s" : ""} available with structured insights.`}
                          ctaLabel="View Analysis"
                          onClick={openTextContentModal}
                        />
                      ) : null}

                      {premiumImageGallery.length > 0 ? (
                        <PremiumContentCard
                          icon="🖼️"
                          title="Image Content"
                          description={`${premiumImageGallery.length} premium image${premiumImageGallery.length > 1 ? "s" : ""} available in gallery mode.`}
                          ctaLabel="View Analysis"
                          onClick={openPremiumImageViewer}
                        />
                      ) : null}

                      {premiumVideoContent.length > 0 ? (
                        <PremiumContentCard
                          icon="🎥"
                          title="Video Content"
                          description={`${premiumVideoContent.length} premium video${premiumVideoContent.length > 1 ? "s" : ""} available for streaming.`}
                          ctaLabel="Watch Analysis"
                          onClick={openVideoContentModal}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 text-gray-600">
                      No premium content available.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 space-y-4 sm:space-y-5">
                  <div className="w-full rounded-2xl bg-gradient-to-br from-white to-orange-50 border border-orange-200/70 shadow-2xl p-6 sm:p-8 text-center">
                    <p className="text-sm sm:text-base font-semibold text-orange-700 mb-2">Advanced Analysis Locked</p>
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-3">Unlock KAIRO Analysis & Teams</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-lg mx-auto">
                      Unlock captain picks, differential teams, and advanced analysis.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                      {ENABLE_WEEKLY_PLAN ? (
                        <div className="rounded-xl border border-orange-300/80 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-lg">
                          {WEEKLY_OFFER_ACTIVE ? (
                            <p className="text-xs font-semibold text-red-600 mb-1">🔥 Limited Time Offer</p>
                          ) : null}
                          <p className="text-base sm:text-lg font-bold text-gray-900">Weekly Access</p>
                          <div className="flex items-end gap-2 mt-1 mb-2">
                            {WEEKLY_OFFER_ACTIVE ? (
                              <span className="text-sm text-gray-500 line-through">₹{pricing.weekly_original_price}</span>
                            ) : null}
                            <span className="text-2xl font-extrabold text-orange-600">₹{pricing.weekly_price}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 mb-3">Best for quick wins 🚀</p>
                          <button
                            onClick={handleUnlockWeekly}
                            className="w-full bg-gradient-primary text-white py-3 px-5 rounded-xl text-sm sm:text-base font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5"
                          >
                            Unlock for 7 Days
                          </button>
                        </div>
                      ) : null}

                      {ENABLE_MONTHLY_PLAN ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md">
                          {MONTHLY_OFFER_ACTIVE ? (
                            <p className="text-xs font-semibold text-red-600 mb-1">Limited Offer</p>
                          ) : null}
                          <p className="text-base sm:text-lg font-bold text-gray-900">Monthly Access</p>
                          <div className="flex items-end gap-2 mt-1 mb-2">
                            {MONTHLY_OFFER_ACTIVE ? (
                              <span className="text-sm text-gray-500 line-through">₹{pricing.monthly_original_price}</span>
                            ) : null}
                            <span className="text-2xl font-extrabold text-gray-900">₹{pricing.monthly_price}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 mb-3">Best value for consistent players</p>
                          <button
                            onClick={handleUnlockSubscription}
                            className="w-full bg-white text-gray-900 border border-gray-200 py-3 px-5 rounded-xl text-sm sm:text-base font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5"
                          >
                            Unlock for 30 Days
                          </button>
                        </div>
                      ) : null}

                      {ENABLE_MATCH_PLAN ? (
                        <button
                          onClick={handleUnlockPremium}
                          className="w-full bg-white text-gray-900 border border-gray-200 py-3 sm:py-4 px-6 rounded-xl text-base sm:text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5 sm:col-span-2"
                        >
                          Unlock Match ₹{pricing.match_price}
                        </button>
                      ) : null}

                      {!ENABLE_WEEKLY_PLAN && !ENABLE_MONTHLY_PLAN ? (
                        <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                          No subscription plans are currently available.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <LockedPremiumPreviewCards />
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
                {freeTextContent.length > 0 ? (
                  <FreeTextReportCard textCount={freeTextContent.length} onOpen={openFreeTextModal} />
                ) : null}

                {freePdfDocuments.length > 0 ? (
                  <FreePdfAnalysisCard pdfCount={freePdfDocuments.length} onOpen={openPdfViewer} />
                ) : null}

                {freeImageContent.length > 0 ? (
                  <GLAnalysisCard imageCount={freeImageContent.length} onOpen={openFreeImageViewer} />
                ) : null}

                {freeTextContent.length === 0 && freePdfDocuments.length === 0 && freeImageContent.length === 0 ? (
                  <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 text-gray-600">
                    No free content available.
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}

          <FreeTextContentModal
            isOpen={isFreeTextModalOpen}
            items={freeTextContent}
            onClose={closeFreeTextModal}
          />

          <PdfViewerModal
            isOpen={isPdfViewerOpen}
            documents={freePdfDocuments}
            activeIndex={activePdfIndex}
            onClose={closePdfViewer}
            onPrev={showPreviousPdf}
            onNext={showNextPdf}
            onSetIndex={setActivePdfIndex}
          />

          <TextContentModal
            isOpen={isTextContentModalOpen}
            items={premiumTextContent}
            onClose={closeTextContentModal}
          />

          <VideoContentModal
            isOpen={isVideoContentModalOpen}
            videos={premiumVideoContent}
            activeIndex={activeVideoIndex}
            onClose={closeVideoContentModal}
            onPrev={showPreviousVideo}
            onNext={showNextVideo}
            onSetIndex={setActiveVideoIndex}
          />

          <ImageViewerModal
            isOpen={isFreeImageViewerOpen}
            images={freeImageGallery}
            activeIndex={activeFreeImageIndex}
            title="GL Analysis"
            onClose={closeFreeImageViewer}
            onPrev={showPreviousFreeImage}
            onNext={showNextFreeImage}
            onSetIndex={setActiveFreeImageIndex}
          />

          <ImageViewerModal
            isOpen={isPremiumImageViewerOpen}
            images={premiumImageGallery}
            activeIndex={activePremiumImageIndex}
            title="KAIRO Visual Analysis"
            onClose={closePremiumImageViewer}
            onPrev={showPreviousPremiumImage}
            onNext={showNextPremiumImage}
            onSetIndex={setActivePremiumImageIndex}
        />
      </div>
    </div>
  );
}
