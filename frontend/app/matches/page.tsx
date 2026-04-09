type Team = {
  key: string;
  name: string;
  short_name: string;
  color_primary?: string;
};

type Match = {
  key: string;
  title: string;
  short_title: string;
  subtitle?: string;
  start_at: string;
  status: "scheduled" | "live" | "completed";
  match_format: "T20" | "ODI" | "Test";
  teams: Team[];
  venue?: {
    name: string;
    city: string;
  };
  is_featured: boolean;
  isPremium?: boolean;
};

const freeMatches: Match[] = [
  {
    key: "free-1",
    title: "Mumbai Indians vs Chennai Super Kings",
    short_title: "MI vs CSK",
    subtitle: "League Match",
    start_at: "2026-04-06T14:30:00Z",
    status: "live",
    match_format: "T20",
    teams: [
      { key: "mi", name: "Mumbai Indians", short_name: "MI", color_primary: "#1D4ED8" },
      { key: "csk", name: "Chennai Super Kings", short_name: "CSK", color_primary: "#EAB308" },
    ],
    venue: { name: "Wankhede Stadium", city: "Mumbai" },
    is_featured: true,
  },
  {
    key: "free-2",
    title: "Delhi Capitals vs Rajasthan Royals",
    short_title: "DC vs RR",
    subtitle: "League Match",
    start_at: "2026-04-07T10:00:00Z",
    status: "scheduled",
    match_format: "T20",
    teams: [
      { key: "dc", name: "Delhi Capitals", short_name: "DC", color_primary: "#2563EB" },
      { key: "rr", name: "Rajasthan Royals", short_name: "RR", color_primary: "#EC4899" },
    ],
    venue: { name: "Arun Jaitley Stadium", city: "Delhi" },
    is_featured: false,
  },
  {
    key: "free-3",
    title: "India vs Australia",
    short_title: "IND vs AUS",
    subtitle: "1st ODI",
    start_at: "2026-04-05T07:30:00Z",
    status: "completed",
    match_format: "ODI",
    teams: [
      { key: "ind", name: "India", short_name: "IND", color_primary: "#1E40AF" },
      { key: "aus", name: "Australia", short_name: "AUS", color_primary: "#16A34A" },
    ],
    venue: { name: "Eden Gardens", city: "Kolkata" },
    is_featured: false,
  },
];

const premiumMatches: Match[] = [
  {
    key: "premium-1",
    title: "Punjab Kings vs Gujarat Titans",
    short_title: "PBKS vs GT",
    subtitle: "Captaincy Boosters",
    start_at: "2026-04-08T14:30:00Z",
    status: "scheduled",
    match_format: "T20",
    teams: [
      { key: "pbks", name: "Punjab Kings", short_name: "PBKS", color_primary: "#DC2626" },
      { key: "gt", name: "Gujarat Titans", short_name: "GT", color_primary: "#0F172A" },
    ],
    venue: { name: "IS Bindra Stadium", city: "Mohali" },
    is_featured: true,
    isPremium: true,
  },
  {
    key: "premium-2",
    title: "Kolkata Knight Riders vs Sunrisers Hyderabad",
    short_title: "KKR vs SRH",
    subtitle: "Differential Picks",
    start_at: "2026-04-09T14:30:00Z",
    status: "scheduled",
    match_format: "T20",
    teams: [
      { key: "kkr", name: "Kolkata Knight Riders", short_name: "KKR", color_primary: "#6D28D9" },
      { key: "srh", name: "Sunrisers Hyderabad", short_name: "SRH", color_primary: "#EA580C" },
    ],
    venue: { name: "Eden Gardens", city: "Kolkata" },
    is_featured: true,
    isPremium: true,
  },
  {
    key: "premium-3",
    title: "England vs New Zealand",
    short_title: "ENG vs NZ",
    subtitle: "Grand League Core",
    start_at: "2026-04-10T11:00:00Z",
    status: "scheduled",
    match_format: "ODI",
    teams: [
      { key: "eng", name: "England", short_name: "ENG", color_primary: "#1D4ED8" },
      { key: "nz", name: "New Zealand", short_name: "NZ", color_primary: "#111827" },
    ],
    venue: { name: "Lords", city: "London" },
    is_featured: false,
    isPremium: true,
  },
];

const getStatusColor = (status: Match["status"]) => {
  if (status === "live") return "bg-green-100 text-green-800 border-green-200";
  if (status === "scheduled") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
};

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
};

function MatchCard({ match }: { match: Match }) {
  const { date, time } = formatDateTime(match.start_at);

  return (
    <div className="bg-gradient-card rounded-2xl border border-gray-200/50 p-6 hover:shadow-craft-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(match.status)}`}>
            {match.status.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500">{match.match_format}</span>
        </div>

        {match.is_featured && (
          <div className="flex items-center space-x-1 text-xs text-yellow-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>Featured</span>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {match.teams.map((team) => (
          <div key={team.key} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: team.color_primary || "#f97316" }}
              >
                {team.short_name.substring(0, 2)}
              </div>
              <div>
                <div className="font-medium text-gray-900">{team.short_name}</div>
                <div className="text-xs text-gray-500">{team.name}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
        <div>
          <div className="font-medium">{match.venue?.name}</div>
          <div className="text-xs">{match.venue?.city}</div>
        </div>
        <div className="text-right">
          <div>{date}</div>
          <div className="text-xs">{time}</div>
        </div>
      </div>

      <div className="flex space-x-2">
        <button className="flex-1 bg-gradient-primary text-white py-2 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200">
          View Details
        </button>
        {match.isPremium && (
          <button className="flex-1 bg-gradient-secondary text-gray-900 py-2 px-4 rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-200">
            Expert Analysis
          </button>
        )}
      </div>
    </div>
  );
}

export default function MatchesPage() {
  return (
    <div className="min-h-screen bg-gradient-radial py-6 sm:py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6 lg:mb-8 px-2 sm:px-4 md:px-6 lg:px-8">
            Cricket Matches
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 max-w-2xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
            Stay updated with live scores and unlock KAIRO insights
          </p>
        </div>

        <section className="mb-10 sm:mb-12 md:mb-14">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Match Analysis &amp; GL Team</h2>
            <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-green-100 text-green-700 border border-green-200">
              GL Analysis
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {freeMatches.map((match) => (
              <MatchCard key={match.key} match={match} />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">KAIRO Analysis &amp; KAIRO Teams</h2>
            <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-gradient-primary text-white shadow-lg">
              KAIRO
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8 blur-[2.5px] select-none pointer-events-none p-1">
              {premiumMatches.map((match) => (
                <MatchCard key={match.key} match={match} />
              ))}
            </div>

            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1.5px] flex items-center justify-center p-4 sm:p-6">
              <div className="w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-orange-50 border border-orange-200/70 shadow-2xl p-6 sm:p-8 text-center">
                <p className="text-sm sm:text-base font-semibold text-orange-700 mb-2">Advanced Analysis Locked</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-3">Get Winning Edge</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-6">
                  Unlock captain picks, differential teams, and KAIRO match analysis.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button className="w-full bg-gradient-primary text-white py-3 sm:py-4 px-6 rounded-xl text-base sm:text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5">
                    Match ₹39
                  </button>
                  <button className="w-full bg-white text-gray-900 border border-gray-200 py-3 sm:py-4 px-6 rounded-xl text-base sm:text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5">
                    Monthly ₹399
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
