"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  fetchMatches,
  getUpdates,
  markUpdateRead,
  type MatchApiItem,
  type UpdateApiItem,
} from "@/services/api";

type MatchItem = {
  id: number;
  key: string;
  name: string;
  start_at: string;
  status: "started" | "not_started" | "completed";
  format: string;
  tournament: {
    name: string;
  };
  teams: {
    a?: {
      name: string;
      country_code?: string;
    };
    b?: {
      name: string;
      country_code?: string;
    };
  };
  venue?: {
    name: string;
    city: string;
  };
};

type TabId = "featured" | "live" | "upcoming";

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: "🏠", sectionId: "welcome-section" },
  { id: "expert-analysis", label: "Expert Analysis", icon: "📊", sectionId: "expert-analysis-section" },
  { id: "updates", label: "Updates", icon: "📰", sectionId: "updates-section" },
] as const;

const tabs = [
  {
    id: "featured" as const,
    label: "Featured",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
  },
  {
    id: "live" as const,
    label: "Live",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    id: "upcoming" as const,
    label: "Upcoming",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FormattedUpdateBody({ body }: { body: string }) {
  const lines = body.split(/\r?\n/);
  const bulletRegex = /^\s*([\-*•]|\d+[.)])\s+/;
  const nodes: ReactNode[] = [];
  let bullets: string[] = [];
  let keyIndex = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;

    nodes.push(
      <ul key={`update-bullets-${keyIndex++}`} className="list-disc pl-5 space-y-1 text-sm sm:text-base text-gray-700">
        {bullets.map((item, index) => (
          <li key={`update-bullet-${index}`}>{item}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      continue;
    }

    if (bulletRegex.test(line)) {
      bullets.push(line.replace(bulletRegex, "").trim());
      continue;
    }

    flushBullets();
    nodes.push(
      <p key={`update-paragraph-${keyIndex++}`} className="text-sm sm:text-base text-gray-700 leading-relaxed">
        {line}
      </p>
    );
  }

  flushBullets();
  return <div className="space-y-2">{nodes}</div>;
}

function getStatusColor(status: MatchItem["status"]) {
  switch (status) {
    case "started":
      return "bg-gradient-to-r from-red-500 to-pink-500";
    case "not_started":
      return "bg-gradient-to-r from-blue-500 to-indigo-500";
    case "completed":
      return "bg-gradient-to-r from-green-500 to-emerald-500";
    default:
      return "bg-gradient-to-r from-gray-500 to-gray-600";
  }
}

function getStatusText(status: MatchItem["status"]) {
  switch (status) {
    case "started":
      return "LIVE";
    case "not_started":
      return "UPCOMING";
    case "completed":
      return "COMPLETED";
  }
}

function mapApiMatchToUi(match: MatchApiItem): MatchItem {
  const date = new Date(match.match_date);
  const now = new Date();

  let status: MatchItem["status"] = "not_started";
  if (!Number.isNaN(date.getTime()) && date.getTime() < now.getTime() - 2 * 60 * 60 * 1000) {
    status = "completed";
  }

  return {
    id: match.id,
    key: `match-${match.id}`,
    name: match.match_name,
    start_at: match.match_date,
    status,
    format: "t20",
    tournament: { name: match.match_name },
    teams: {
      a: { name: match.team_1, country_code: match.team_1.slice(0, 3).toUpperCase() },
      b: { name: match.team_2, country_code: match.team_2.slice(0, 3).toUpperCase() },
    },
    venue: { name: "TBA", city: "TBA" },
  };
}

function EnhancedWelcomeHeader({ userName, isPremium }: { userName: string; isPremium: boolean }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const firstName = userName.split(" ")[0] || "there";
  const hour = currentTime.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/50 to-orange-50/30 rounded-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,165,0,0.05),transparent_70%)]" />

      <motion.div
        className="absolute top-6 right-6 w-12 h-12 bg-gradient-to-br from-orange-400/10 to-red-400/10 rounded-full blur-lg"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 p-8 lg:p-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-sm lg:text-base text-gray-500 font-medium mb-3">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>

              <h1 className="text-3xl lg:text-5xl xl:text-6xl font-bold mb-4">
                <span className="text-gray-900">{greeting}, </span>
                <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{firstName}</span>
              </h1>

              <motion.p
                className="text-lg lg:text-xl text-gray-600 max-w-2xl leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                Welcome to KAIRO Intelligence System
              </motion.p>
            </motion.div>
          </div>

          {isPremium && (
            <motion.div
              className="lg:flex-shrink-0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-yellow-400/10 to-orange-500/10 backdrop-blur-sm border border-yellow-300/20 rounded-full px-6 py-3"
                whileHover={{ scale: 1.05, y: -2 }}
              >
                <motion.div
                  className="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </motion.div>
                <span className="text-sm font-semibold text-gray-700">Premium</span>
              </motion.div>
            </motion.div>
          )}
        </div>

        <motion.div
          className="mt-8 lg:mt-10 flex items-center space-x-2 text-sm text-gray-400"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <motion.div
            className="w-1.5 h-1.5 bg-orange-400 rounded-full"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span>Explore live insights and expert analysis below</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ModernNavbar({
  userName,
  isPremium,
  unreadUpdatesCount,
  onOpenUpdates,
  onLogout,
}: {
  userName: string;
  isPremium: boolean;
  unreadUpdatesCount: number;
  onOpenUpdates: () => void;
  onLogout: () => void;
}) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const parallaxOffset = Math.min(scrollY * 0.5, 50);

  const scrollToSection = (sectionId: string, itemId: string) => {
    setActiveSection(itemId);
    if (itemId === "updates") {
      onOpenUpdates();
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className={`
          relative bg-white/10 backdrop-blur-2xl border border-white/20
          rounded-3xl shadow-2xl shadow-black/10
          transition-all duration-500 ease-out
          ${isScrolled ? "bg-white/20 backdrop-blur-3xl border-white/30 shadow-xl shadow-black/20" : "bg-white/10 backdrop-blur-2xl border-white/20"}
          px-6 py-3 lg:px-8 lg:py-4
          before:absolute before:inset-0 before:rounded-3xl
          before:bg-gradient-to-r before:from-yellow-400/10 before:via-orange-400/10 before:to-yellow-400/10
          before:-z-10 before:blur-xl
          after:absolute after:inset-0 after:rounded-3xl
          after:bg-gradient-to-r after:from-yellow-500/5 after:to-orange-500/5
          after:-z-10
          overflow-visible
        `}
        style={{
          backdropFilter: `blur(${isScrolled ? "24px" : "16px"}) saturate(180%)`,
          WebkitBackdropFilter: `blur(${isScrolled ? "24px" : "16px"}) saturate(180%)`,
          transform: `translateY(${parallaxOffset * 0.3}px)`,
          boxShadow: isScrolled
            ? "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4)"
            : "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        }}
        whileHover={{
          scale: 1.02,
          boxShadow: "0 30px 60px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-3xl">
          <motion.div
            className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full opacity-20 blur-xl"
            animate={{ x: [0, 10, 0], y: [0, -5, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-3 -right-3 w-6 h-6 bg-gradient-to-r from-orange-400 to-yellow-500 rounded-full opacity-15 blur-lg"
            animate={{ x: [0, -8, 0], y: [0, 8, 0], scale: [1, 0.8, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </div>

        <div className="relative flex items-center justify-center gap-4 lg:gap-6">
          <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
            <div className="relative">
              <motion.img
                src="/logo.jpg"
                alt="Grand League Expert"
                className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl object-cover relative z-10"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
                whileHover={{ boxShadow: "0 0 20px rgba(255, 165, 0, 0.4)", filter: "brightness(1.1)" }}
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 opacity-20 blur-md -z-10" />
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 items-center justify-center shadow-lg hidden" style={{ display: "none" }}>
                <span className="text-white text-sm lg:text-base font-bold">GL</span>
              </div>
            </div>
          </motion.div>

          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {navigationItems.map((item, index) => (
              <motion.button
                key={item.id}
                onClick={() => scrollToSection(item.sectionId, item.id)}
                className={`
                  relative px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-sm lg:text-base font-medium
                  transition-all duration-300 ease-out
                  backdrop-blur-sm border border-transparent
                  ${activeSection === item.id
                    ? "bg-gradient-to-r from-yellow-400/20 to-orange-500/20 text-gray-800 border-yellow-400/30 shadow-lg shadow-yellow-400/20"
                    : "text-gray-700 hover:text-gray-900 hover:bg-white/20 hover:border-white/30 hover:backdrop-blur-md"}
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: activeSection === item.id
                    ? "0 8px 32px rgba(255, 165, 0, 0.3)"
                    : "0 4px 20px rgba(0, 0, 0, 0.1)",
                }}
                whileTap={{ scale: 0.95 }}
              >
                {activeSection === item.id && (
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-yellow-400/10 to-orange-500/10"
                    layoutId="activeTab"
                    transition={{ duration: 0.3 }}
                  />
                )}
                <span className="relative z-10">
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="lg:hidden text-lg">{item.icon}</span>
                  {item.id === "updates" && unreadUpdatesCount > 0 ? (
                    <span className="ml-2 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                  ) : null}
                </span>
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            {isPremium && (
              <motion.div
                className="relative px-2.5 py-1 lg:px-3 lg:py-1.5 bg-gradient-to-r from-yellow-400/80 to-orange-500/80 backdrop-blur-sm text-white rounded-lg text-xs lg:text-sm font-medium shadow-lg"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(255, 165, 0, 0.6)" }}
              >
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500 opacity-20 blur-md" />
                <span className="relative z-10">Pro</span>
              </motion.div>
            )}

            <motion.button
              onClick={onLogout}
              className="flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl bg-gradient-to-r from-red-500/80 to-red-600/80 hover:from-red-600/90 hover:to-red-700/90 backdrop-blur-sm border border-red-400/30 hover:border-red-400/50 text-white transition-all duration-300 shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.02, boxShadow: "0 8px 32px rgba(239, 68, 68, 0.3)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm lg:text-base font-medium hidden sm:block">Logout</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.nav>
  );
}

function MatchCard({
  match,
  onMatchClick,
}: {
  match: MatchItem;
  onMatchClick: (match: MatchItem) => void;
}) {
  return (
    <motion.div
      className="group cursor-pointer pointer-events-auto"
      onClick={() => onMatchClick(match)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm rounded-2xl border border-white/30 shadow-lg overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:border-white/50">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(match.status)}`}>
                {getStatusText(match.status)}
              </div>
              <div className="text-sm text-gray-600 uppercase font-medium">{match.format}</div>
            </div>
            <div className="text-sm text-gray-500">{formatDate(match.start_at)}</div>
          </div>

          <div className="mb-4">
            <h3 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{match.name}</h3>
            <p className="text-gray-600 text-sm">{match.tournament.name}</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex space-x-4">
              <div className="text-center">
                <p className="font-medium text-gray-800">{match.teams.a?.name}</p>
                <p className="text-xs text-gray-500">{match.teams.a?.country_code}</p>
              </div>
              <div className="flex items-center">
                <span className="text-gray-400 font-bold">VS</span>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-800">{match.teams.b?.name}</p>
                <p className="text-xs text-gray-500">{match.teams.b?.country_code}</p>
              </div>
            </div>

            {match.venue && (
              <div className="text-right">
                <p className="text-xs text-gray-600">{match.venue.name}</p>
                <p className="text-xs text-gray-500">{match.venue.city}</p>
              </div>
            )}
          </div>

          {match.status === "started" && (
            <div className="mt-4 pt-4 border-t border-gray-200/50">
              <div className="flex justify-center">
                <div className="animate-pulse bg-red-500 h-2 w-2 rounded-full mr-2"></div>
                <span className="text-xs text-red-600 font-medium">LIVE MATCH IN PROGRESS</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [updates, setUpdates] = useState<UpdateApiItem[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("featured");

  const handleMatchClick = (match: MatchItem) => {
    router.push(`/matches/${match.id}`);
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setUpdatesLoading(true);
        setError(null);

        const [matchesResult, updatesResult] = await Promise.allSettled([
          fetchMatches(),
          getUpdates(),
        ]);

        if (matchesResult.status === "fulfilled") {
          setMatches(matchesResult.value.map(mapApiMatchToUi));
        } else {
          setError(
            matchesResult.reason instanceof Error
              ? matchesResult.reason.message
              : "Failed to load matches"
          );
        }

        if (updatesResult.status === "fulfilled") {
          setUpdates(updatesResult.value);
        } else {
          setUpdates([]);
        }
      } finally {
        setLoading(false);
        setUpdatesLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const unreadUpdatesCount = useMemo(
    () => updates.filter((item) => !item.is_read).length,
    [updates]
  );

  const markUpdatesAsRead = async (updateIds: number[]) => {
    const unreadIds = updateIds.filter((id) => updates.some((item) => item.id === id && !item.is_read));
    if (unreadIds.length === 0) return;

    setUpdates((prev) =>
      prev.map((item) =>
        unreadIds.includes(item.id)
          ? { ...item, is_read: true }
          : item
      )
    );

    await Promise.allSettled(unreadIds.map((id) => markUpdateRead(id)));
  };

  const handleOpenUpdatesSection = () => {
    const unreadIds = updates.filter((item) => !item.is_read).map((item) => item.id);
    void markUpdatesAsRead(unreadIds);
  };

  const handleUpdateClick = (updateId: number) => {
    void markUpdatesAsRead([updateId]);
  };

  const liveMatches = useMemo(() => matches.filter((m) => m.status === "started"), [matches]);
  const upcomingMatches = useMemo(() => matches.filter((m) => m.status === "not_started"), [matches]);
  const featuredMatches = matches;

  const displayData = useMemo(() => {
    switch (activeTab) {
      case "live":
        return liveMatches;
      case "upcoming":
        return upcomingMatches;
      default:
        return featuredMatches;
    }
  }, [activeTab, featuredMatches, liveMatches, upcomingMatches]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.3),transparent_50%)]" />
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,rgba(255,180,0,0.2),transparent_50%)]" />
          <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,rgba(34,197,94,0.2),transparent_50%)]" />
          <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(239,68,68,0.2),transparent_50%)]" />
        </div>
      </div>

      <ModernNavbar
        userName={session?.user?.name || "User"}
        isPremium={false}
        unreadUpdatesCount={unreadUpdatesCount}
        onOpenUpdates={handleOpenUpdatesSection}
        onLogout={() => void signOut({ callbackUrl: "/" })}
      />

      <main className="relative pt-16 lg:pt-20">
        <div className="absolute inset-0 pt-16 lg:pt-20 pointer-events-none">
          <div
            className="h-full bg-white/10 backdrop-blur-xl border-t border-white/20"
            style={{
              backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: 5 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.2 }}
            className="space-y-12 lg:space-y-16"
            style={{ perspective: "1000px" }}
          >
            <motion.section
              id="welcome-section"
              initial={{ opacity: 0, y: 20, rotateX: 10 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 rounded-3xl blur-xl" />
              <div
                className="relative bg-white/20 backdrop-blur-2xl border border-white/30 rounded-3xl p-1 shadow-2xl shadow-black/5"
                style={{
                  backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)",
                  backdropFilter: "blur(24px) saturate(200%)",
                  WebkitBackdropFilter: "blur(24px) saturate(200%)",
                }}
              >
                <div className="bg-white/40 backdrop-blur-sm rounded-3xl p-6 lg:p-8">
                  <EnhancedWelcomeHeader userName={session?.user?.name || "User"} isPremium={false} />
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20, rotateX: 8 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-teal-500/5 rounded-3xl blur-xl" />
              <div
                className="relative bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-1 shadow-2xl shadow-black/5"
                style={{
                  backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                }}
              >
                <div className="bg-white/40 backdrop-blur-sm rounded-3xl p-6 lg:p-8">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">For You</h2>
                        <p className="text-gray-600">Personalized cricket data and match insights</p>
                      </div>
                    </div>
                  </div>

                  <motion.div
                    className="bg-gradient-to-br from-white/90 via-white/85 to-white/80 backdrop-blur-xl rounded-3xl border border-white/30 shadow-2xl overflow-hidden relative"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="relative bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 p-6 border-b border-white/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Cricket Central</h2>
                            <p className="text-sm text-gray-600">Real-time cricket updates</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {loading ? (
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                              <span className="text-xs text-gray-600">Updating...</span>
                            </div>
                          ) : error ? (
                            <div className="flex items-center space-x-2">
                              <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-yellow-600">Using cached data</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-gray-600">Live: {new Date().toLocaleTimeString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex space-x-1 bg-white/50 rounded-2xl p-1 backdrop-blur-sm overflow-x-auto">
                          {tabs.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-xl font-medium transition-all duration-200 flex-shrink-0 justify-center min-w-0 ${
                                activeTab === tab.id
                                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                                  : "text-gray-600 hover:bg-white/70"
                              }`}
                            >
                              {tab.icon}
                              <span className="text-xs sm:text-sm whitespace-nowrap">{tab.label}</span>
                              {tab.id === "live" && liveMatches.length > 0 && (
                                <span className="bg-red-500 text-white text-xs px-1 sm:px-2 py-0.5 rounded-full">{liveMatches.length}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeTab}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4"
                        >
                          {displayData.map((match, index) => (
                            <motion.div
                              key={match.key}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1, duration: 0.4 }}
                            >
                              <Link href={`/matches/${match.id}`} className="block">
                                <MatchCard match={match} onMatchClick={handleMatchClick} />
                              </Link>
                            </motion.div>
                          ))}
                        </motion.div>
                      </AnimatePresence>

                      {displayData.length === 0 && !loading && (
                        <div className="text-center py-12">
                          <p className="text-gray-600 text-lg">No {activeTab} matches available</p>
                          <p className="text-gray-500 text-sm mt-2">Check back later for updates</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.section>

            <motion.section id="expert-analysis-section" className="relative" />

            <motion.section
              id="updates-section"
              initial={{ opacity: 0, y: 20, rotateX: 6 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.26, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/5 via-violet-500/5 to-indigo-500/5 rounded-3xl blur-xl" />
              <div
                className="relative bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-1 shadow-2xl shadow-black/5"
                style={{
                  backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                }}
              >
                <div className="bg-white/40 backdrop-blur-sm rounded-3xl p-6 lg:p-8">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Updates</h2>
                      <p className="text-gray-600">Latest announcements and product changes</p>
                    </div>
                    {unreadUpdatesCount > 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs sm:text-sm font-semibold text-red-700">
                        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                        {unreadUpdatesCount} new
                      </span>
                    ) : null}
                  </div>

                  {updatesLoading ? (
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 text-sm text-gray-600">Loading updates...</div>
                  ) : updates.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 text-sm text-gray-600">No updates right now.</div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {updates.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleUpdateClick(item.id)}
                          className="w-full text-left rounded-2xl border border-gray-200/80 bg-white/80 p-4 sm:p-5 hover:shadow-lg transition-all duration-200"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">{item.title}</h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!item.is_read ? (
                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-red-700">NEW</span>
                              ) : null}
                              <span className="text-xs sm:text-sm text-gray-500">{formatRelativeTime(item.created_at)}</span>
                            </div>
                          </div>
                          <FormattedUpdateBody body={item.body} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20, rotateX: 6 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 via-cyan-500/5 to-blue-500/5 rounded-3xl blur-xl" />
              <div
                className="relative bg-white/15 backdrop-blur-2xl border border-white/30 rounded-3xl p-1 shadow-2xl shadow-black/5"
                style={{
                  backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                }}
              >
                <div className="bg-white/40 backdrop-blur-sm rounded-3xl p-6 lg:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3-3-3z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Help &amp; Support</h2>
                      <p className="text-gray-600">Need help? Contact us at:</p>
                    </div>
                  </div>

                  <a
                    href="mailto:grandleagueexpert2024@gmail.com"
                    className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-800 transition-colors"
                  >
                    <span aria-hidden="true">📧</span>
                    <span>grandleagueexpert2024@gmail.com</span>
                  </a>

                  <p className="mt-3 text-sm text-gray-600">We typically respond within 24 hours.</p>
                </div>
              </div>
            </motion.section>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
