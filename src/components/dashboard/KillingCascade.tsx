import { useState, useEffect, useMemo } from 'react';
import ChalkOutline from './ChalkOutline';

// ── Types ──────────────────────────────────────────────────────────────
interface CaseData {
  id: number;
  fatal: boolean;
  woundRegions: string[];
  woundCount: number;
  numOfficers: number;
  race: string;
  age: number;
  sex: string;
  armed: boolean;
  year: number;
  contactReason: string;
  county: string;
  predictedPFatal: number;
}

type Phase = 'loading' | 'start' | 'guess' | 'reveal' | 'results';

interface UserGuess {
  caseId: number;
  guessedFatal: boolean;
  actualFatal: boolean;
  predictedPFatal: number;
}

const CASES_PER_SESSION = 5;

// ── Fisher-Yates shuffle ───────────────────────────────────────────────
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Main Component ─────────────────────────────────────────────────────
export default function KillingCascade() {
  const [allCases, setAllCases] = useState<CaseData[]>([]);
  const [sessionCases, setSessionCases] = useState<CaseData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guesses, setGuesses] = useState<UserGuess[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [totalVisitors, setTotalVisitors] = useState<number | null>(null);
  const [avgVisitorAccuracy, setAvgVisitorAccuracy] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load case data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/data/killing-cascade/cases.json?v=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to load case data');
        const data: CaseData[] = await res.json();
        setAllCases(data);
        setPhase('start');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    load();
  }, []);

  // Fetch visitor stats on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/quiz/cascade/stats');
        if (res.ok) {
          const data = await res.json();
          setTotalVisitors(data.totalSessions ?? 0);
        }
      } catch {
        // Stats are non-critical, silently fail
      }
    }
    fetchStats();
  }, []);

  const currentCase = sessionCases[currentIndex] ?? null;

  // Model accuracy for this session
  const modelScore = useMemo(() => {
    return guesses.filter(
      (g) => (g.predictedPFatal > 0.5) === g.actualFatal
    ).length;
  }, [guesses]);

  const userScore = useMemo(() => {
    return guesses.filter((g) => g.guessedFatal === g.actualFatal).length;
  }, [guesses]);

  // ── Actions ──────────────────────────────────────────────────────────
  function startSession() {
    const shuffled = shuffleArray(allCases);
    const selected = shuffled.slice(0, CASES_PER_SESSION);
    setSessionCases(selected);
    setCurrentIndex(0);
    setGuesses([]);
    setPhase('guess');
  }

  function handleGuess(guessedFatal: boolean) {
    if (!currentCase) return;
    const guess: UserGuess = {
      caseId: currentCase.id,
      guessedFatal,
      actualFatal: currentCase.fatal,
      predictedPFatal: currentCase.predictedPFatal,
    };
    setGuesses((prev) => [...prev, guess]);
    setPhase('reveal');
  }

  async function handleNext() {
    if (currentIndex < sessionCases.length - 1) {
      setCurrentIndex((i) => i + 1);
      setPhase('guess');
    } else {
      // Submit to Supabase
      setSubmitting(true);
      try {
        const totalCorrect = guesses.filter(
          (g) => g.guessedFatal === g.actualFatal
        ).length;
        const res = await fetch('/api/quiz/cascade/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responses: guesses.map((g) => ({
              caseId: g.caseId,
              userGuess: g.guessedFatal ? 'died' : 'survived',
              actualOutcome: g.actualFatal ? 'died' : 'survived',
              predictedPFatal: g.predictedPFatal,
            })),
            totalCorrect,
            totalCases: sessionCases.length,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setTotalVisitors(data.totalVisitors ?? totalVisitors);
        }
        // Fetch fresh stats (includes all visitors' average)
        const statsRes = await fetch('/api/quiz/cascade/stats');
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setAvgVisitorAccuracy(stats.averageAccuracy ?? null);
          setTotalVisitors(stats.totalSessions ?? totalVisitors);
        }
      } catch {
        // Submission failure is non-critical
      } finally {
        setSubmitting(false);
      }
      setPhase('results');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 text-center">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
        <span className="sr-only">Loading case data...</span>
      </div>
    );
  }

  if (phase === 'start') {
    return <StartScreen totalVisitors={totalVisitors} onStart={startSession} />;
  }

  if (phase === 'results') {
    return (
      <ResultsScreen
        guesses={guesses}
        userScore={userScore}
        modelScore={modelScore}
        totalCases={sessionCases.length}
        totalVisitors={totalVisitors}
        avgVisitorAccuracy={avgVisitorAccuracy}
        onPlayAgain={startSession}
      />
    );
  }

  // Guess or Reveal phase
  if (!currentCase) return null;

  const lastGuess = phase === 'reveal' ? guesses[guesses.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Progress indicator — case dots */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: sessionCases.length }, (_, i) => {
            const isCompleted = i < guesses.length;
            const isCurrent = i === currentIndex;
            const wasCorrect = guesses[i]?.guessedFatal === guesses[i]?.actualFatal;
            return (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isCurrent
                    ? 'bg-red-500 ring-2 ring-red-400/50 scale-125'
                    : isCompleted
                      ? wasCorrect
                        ? 'bg-emerald-600'
                        : 'bg-red-800'
                      : 'bg-gray-600'
                }`}
                aria-label={`Case ${i + 1}${isCurrent ? ' (current)' : isCompleted ? (wasCorrect ? ' (correct)' : ' (incorrect)') : ''}`}
              />
            );
          })}
        </div>
        <span className="text-sm font-mono font-medium text-gray-300">
          Case {currentIndex + 1}/{sessionCases.length}
        </span>
        <div className="flex-1" />
        <span className="text-sm font-mono font-medium text-gray-400">
          {userScore}/{guesses.length > 0 ? guesses.length : 0} correct
        </span>
      </div>

      {/* Main content: chalk outline + case details */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Chalk outline */}
        <div className="flex-shrink-0">
          <ChalkOutline
            wounds={currentCase.woundRegions}
            revealed={phase === 'reveal'}
            fatal={currentCase.fatal}
          />
        </div>

        {/* Case details card */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-5 border border-gray-700 space-y-4">
            <h3 className="font-serif text-lg font-bold text-gray-100 tracking-wide">
              Case #{currentCase.id}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailRow label="Officers Firing" value={String(currentCase.numOfficers)} />
              <DetailRow label="Year" value={String(currentCase.year)} />
              <DetailRow label="Age" value={String(currentCase.age)} />
              <DetailRow label="Sex" value={currentCase.sex} />
              <DetailRow label="Race" value={currentCase.race} />
              <DetailRow label="Armed" value={currentCase.armed ? 'Yes' : 'No'} />
              <DetailRow label="Wound Sites" value={String(currentCase.woundCount)} />
              <DetailRow label="County" value={currentCase.county.replace(' County', '')} />
            </div>

            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Contact Reason</p>
              <p className="text-sm text-gray-200 mt-0.5">{currentCase.contactReason}</p>
            </div>

            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Wound Locations</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {currentCase.woundRegions.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-900/60 text-red-200 border border-red-700/60"
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action area */}
      {phase === 'guess' && (
        <div className="flex flex-col items-center gap-4 pt-2">
          <p className="text-lg font-serif font-semibold text-gray-800 dark:text-gray-200">
            Did this person survive or die?
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => handleGuess(false)}
              className="group relative px-10 py-4 text-lg font-bold rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white transition-all duration-200 shadow-lg shadow-emerald-950/40 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <span className="relative z-10">SURVIVED</span>
              <div className="absolute inset-0 rounded-xl border border-emerald-600/40 group-hover:border-emerald-500/60 transition-colors" />
            </button>
            <button
              onClick={() => handleGuess(true)}
              className="group relative px-10 py-4 text-lg font-bold rounded-xl bg-red-800 hover:bg-red-700 text-white transition-all duration-200 shadow-lg shadow-red-950/40 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
            >
              <span className="relative z-10">DIED</span>
              <div className="absolute inset-0 rounded-xl border border-red-600/40 group-hover:border-red-500/60 transition-colors" />
            </button>
          </div>
        </div>
      )}

      {phase === 'reveal' && lastGuess && (
        <RevealCard guess={lastGuess} currentCase={currentCase} onNext={handleNext} isLast={currentIndex >= sessionCases.length - 1} submitting={submitting} />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-100">{value}</p>
    </div>
  );
}

function StartScreen({
  totalVisitors,
  onStart,
}: {
  totalVisitors: number | null;
  onStart: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-8 py-8">
      <div className="space-y-3">
        <h2 className="font-serif text-4xl md:text-5xl font-black text-gray-900 dark:text-gray-50 tracking-tight">
          The Killing Cascade
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
          Can you predict who survived a police shooting?
        </p>
      </div>

      <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-6 text-left border border-gray-700 space-y-3">
        <p className="text-gray-300 text-sm leading-relaxed">
          Based on <strong className="text-white font-semibold">2,041 real officer-involved shooting cases</strong> from
          California Department of Justice data (2016&ndash;2024), this interactive presents
          you with case details and asks a simple question: <em className="text-gray-200">did this person survive?</em>
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Each case shows the victim&rsquo;s wound locations, demographics, and incident
          details. After your guess, you&rsquo;ll see the actual outcome and how it
          compares to a statistical model&rsquo;s prediction from the research paper.
        </p>
        <p className="text-gray-400 text-xs leading-relaxed">
          Overall, approximately 59% of people shot by police in this dataset died.
          The statistical model gets about 70% right. Can you do better?
        </p>
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-amber-200 text-xs font-medium leading-relaxed">
            Only California and Texas mandate reporting of both fatal and non-fatal officer-involved
            shootings — most national databases only track deaths, missing the 40&ndash;50% of people
            who survive. But California goes further: it collects <em>wound location</em>, which our
            research shows is the single most critical factor in understanding shooting fatality.
            This dashboard is possible only because California collects what almost no one else does.
          </p>
        </div>
      </div>

      <button
        onClick={onStart}
        className="group relative px-12 py-4 text-xl font-bold rounded-xl bg-red-800 hover:bg-red-700 text-white transition-all duration-200 shadow-xl shadow-red-950/50 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
      >
        Start ({CASES_PER_SESSION} cases)
        <div className="absolute inset-0 rounded-xl border border-red-600/30 group-hover:border-red-500/50 transition-colors" />
      </button>

      {totalVisitors !== null && totalVisitors > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {totalVisitors.toLocaleString()} {totalVisitors === 1 ? 'visitor has' : 'visitors have'} taken this challenge
        </p>
      )}

      <a
        href="https://www.crimrxiv.com/pub/7mj8aj3g"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 dark:bg-gray-900 border border-gray-600 hover:border-gray-400 text-gray-200 hover:text-white transition-all duration-200 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Read the paper: &ldquo;The Killing Cascade&rdquo; (Nix &amp; Adams, 2026)
        <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}

function RevealCard({
  guess,
  currentCase,
  onNext,
  isLast,
  submitting,
}: {
  guess: UserGuess;
  currentCase: CaseData;
  onNext: () => void;
  isLast: boolean;
  submitting: boolean;
}) {
  const correct = guess.guessedFatal === guess.actualFatal;
  const pPct = Math.round(guess.predictedPFatal * 100);
  const modelAgreed = (guess.predictedPFatal > 0.5) === guess.actualFatal;

  // Framing: was the actual outcome surprising or expected given the model?
  let oddsText: string;
  if (guess.actualFatal) {
    if (guess.predictedPFatal > 0.7) {
      oddsText = 'The model strongly predicted this fatality.';
    } else if (guess.predictedPFatal > 0.5) {
      oddsText = 'The model leaned toward death, but it was close.';
    } else {
      oddsText = 'This person died despite the model predicting survival — a surprising outcome.';
    }
  } else {
    if (guess.predictedPFatal < 0.3) {
      oddsText = 'The model strongly predicted survival.';
    } else if (guess.predictedPFatal < 0.5) {
      oddsText = 'The model leaned toward survival, but it was close.';
    } else {
      oddsText = 'This person survived despite the model predicting death — a surprising outcome.';
    }
  }

  return (
    <div
      className="rounded-xl p-5 space-y-4 border border-gray-700 bg-gray-900 dark:bg-gray-950"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: correct ? '#059669' : '#dc2626',
      }}
    >
      {/* Outcome banner */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`font-serif text-2xl font-black tracking-tight ${
          currentCase.fatal ? 'text-red-400' : 'text-emerald-400'
        }`}>
          {currentCase.fatal ? 'DIED' : 'SURVIVED'}
        </span>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
          correct
            ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700/60'
            : 'bg-red-900/80 text-red-200 border border-red-700/60'
        }`}>
          {correct ? 'Correct' : 'Incorrect'}
        </span>
      </div>

      {/* Probability bar section */}
      <div className="space-y-2 bg-gray-800/60 rounded-lg p-4">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-gray-200">
            Model predicted: <span className="font-mono font-bold text-white">{pPct}%</span> chance of death
          </span>
          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
            modelAgreed
              ? 'bg-emerald-900/60 text-emerald-200'
              : 'bg-amber-900/60 text-amber-200'
          }`}>
            {modelAgreed ? 'Model correct' : 'Model wrong'}
          </span>
        </div>
        <div className="h-4 bg-gray-950 rounded-full overflow-hidden relative border border-gray-700">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pPct}%`,
              background: `linear-gradient(90deg, #059669, #b91c1c)`,
            }}
          />
          {/* 50% marker */}
          <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gray-400" />
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-400">
          <span>0% &mdash; Likely survived</span>
          <span>Likely died &mdash; 100%</span>
        </div>
      </div>

      {/* Odds interpretation */}
      <p className="text-sm text-gray-300 leading-relaxed">{oddsText}</p>

      {/* Next button */}
      <div className="flex justify-end pt-1">
        <button
          onClick={onNext}
          disabled={submitting}
          className="px-8 py-2.5 font-bold rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
        >
          {submitting ? 'Saving...' : isLast ? 'See Results' : 'Next Case'}
        </button>
      </div>
    </div>
  );
}

function ResultsScreen({
  guesses,
  userScore,
  modelScore,
  totalCases,
  totalVisitors,
  avgVisitorAccuracy,
  onPlayAgain,
}: {
  guesses: UserGuess[];
  userScore: number;
  modelScore: number;
  totalCases: number;
  totalVisitors: number | null;
  avgVisitorAccuracy: number | null;
  onPlayAgain: () => void;
}) {
  const userPct = Math.round((userScore / totalCases) * 100);
  const modelPct = Math.round((modelScore / totalCases) * 100);
  const visitorPct = avgVisitorAccuracy !== null ? Math.round(avgVisitorAccuracy * 100) : null;

  let verdict: string;
  if (userScore > modelScore) {
    verdict = 'You outperformed the statistical model. Impressive intuition.';
  } else if (userScore === modelScore) {
    verdict = 'You matched the statistical model exactly.';
  } else {
    verdict = 'The statistical model edged you out — wound location and officer count are powerful predictors.';
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <div className="text-center space-y-2">
        <h2 className="font-serif text-3xl md:text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
          Results
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {totalCases} cases completed
        </p>
      </div>

      {/* Score comparison */}
      <div className={`grid gap-4 grid-cols-2 ${visitorPct !== null ? 'md:grid-cols-3' : ''}`}>
        {/* User score — primary, highlighted */}
        <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-5 text-center border-2 border-red-700/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />
          <p className="text-sm font-medium text-gray-300 mb-1">Your Score</p>
          <p className="font-serif text-4xl font-black text-white">
            {userScore}<span className="text-lg text-gray-500">/{totalCases}</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">{userPct}% accuracy</p>
        </div>
        {/* Model score */}
        <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-5 text-center border border-gray-700">
          <p className="text-sm font-medium text-gray-400 mb-1">Model Score</p>
          <p className="font-serif text-4xl font-black text-gray-100">
            {modelScore}<span className="text-lg text-gray-500">/{totalCases}</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">{modelPct}% accuracy</p>
        </div>
        {/* Visitor score */}
        {visitorPct !== null && (
          <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-5 text-center border border-gray-700 col-span-2 md:col-span-1">
            <p className="text-sm font-medium text-gray-400 mb-1">All Visitors</p>
            <p className="font-serif text-4xl font-black text-gray-100">
              {visitorPct}<span className="text-lg text-gray-500">%</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              avg accuracy{totalVisitors ? ` (n=${totalVisitors.toLocaleString()})` : ''}
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-gray-200 dark:text-gray-300 font-medium">{verdict}</p>

      {/* Case-by-case breakdown */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Outcome</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Your Guess</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Model P(death)</th>
            </tr>
          </thead>
          <tbody>
            {guesses.map((g, i) => {
              const isCorrect = g.guessedFatal === g.actualFatal;
              return (
                <tr key={i} className="border-b border-gray-800 last:border-0">
                  <td className="px-3 py-2 font-mono text-gray-400">{i + 1}</td>
                  <td className={`px-3 py-2 font-semibold ${g.actualFatal ? 'text-red-300' : 'text-emerald-300'}`}>
                    {g.actualFatal ? 'Died' : 'Survived'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1.5 font-medium ${isCorrect ? 'text-gray-200' : 'text-gray-400'}`}>
                      {g.guessedFatal ? 'Died' : 'Survived'}
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                        isCorrect
                          ? 'bg-emerald-900/80 text-emerald-200'
                          : 'bg-red-900/80 text-red-200'
                      }`}>
                        {isCorrect ? '\u2713' : '\u2717'}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-300">
                    {Math.round(g.predictedPFatal * 100)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Key takeaway */}
      <div className="bg-gray-800 dark:bg-gray-900 rounded-xl p-5 border border-gray-700 space-y-2">
        <h3 className="font-serif font-bold text-lg text-gray-100">Key Finding from the Research</h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          Wound location is the dominant predictor of fatality: being struck in the head/neck
          or chest increases the odds of death by 45&ndash;53x compared to extremity wounds.
          Each additional officer firing increases fatality risk by ~13%, partly through
          a &ldquo;killing cascade&rdquo; where more officers produce more wounds in more lethal locations.
        </p>
      </div>

      {/* Big picture */}
      <div className="bg-amber-950/30 rounded-xl p-5 border border-amber-800/40 space-y-2">
        <h3 className="font-serif font-bold text-lg text-amber-200">Why Only California?</h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          Only California and Texas mandate reporting of both fatal and non-fatal officer-involved
          shootings. National databases like the Washington Post&rsquo;s Fatal Force and Mapping Police
          Violence only track deaths, missing the 40&ndash;50% of people who are shot but survive.
          California goes a step further by collecting <em>wound location</em> data — which this
          research shows is the single most critical factor in predicting whether someone lives or
          dies. This dashboard exists because California collects what almost no one else does.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onPlayAgain}
          className="group relative px-10 py-3 text-lg font-bold rounded-xl bg-red-800 hover:bg-red-700 text-white transition-all duration-200 shadow-lg shadow-red-950/40 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
        >
          Play Again
          <div className="absolute inset-0 rounded-xl border border-red-600/30 group-hover:border-red-500/50 transition-colors" />
        </button>

        {totalVisitors !== null && totalVisitors > 0 && (
          <p className="text-sm text-gray-500">
            {totalVisitors.toLocaleString()} visitors have taken this challenge
          </p>
        )}

        <a
          href="https://www.crimrxiv.com/pub/7mj8aj3g"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 dark:bg-gray-900 border border-gray-600 hover:border-gray-400 text-gray-200 hover:text-white transition-all duration-200 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Read the full paper: &ldquo;The Killing Cascade&rdquo; (Nix &amp; Adams, 2026)
          <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
