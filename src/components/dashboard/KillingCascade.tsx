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

const CASES_PER_SESSION = 10;

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
        onPlayAgain={startSession}
      />
    );
  }

  // Guess or Reveal phase
  if (!currentCase) return null;

  const lastGuess = phase === 'reveal' ? guesses[guesses.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Case {currentIndex + 1} of {sessionCases.length}
        </span>
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-600 transition-all duration-300 rounded-full"
            style={{ width: `${((currentIndex + (phase === 'reveal' ? 1 : 0)) / sessionCases.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
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
            <h3 className="text-lg font-semibold text-gray-100">
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
              <p className="text-xs text-gray-400">Contact Reason</p>
              <p className="text-sm text-gray-200">{currentCase.contactReason}</p>
            </div>

            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400">Wound Locations</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {currentCase.woundRegions.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 text-xs rounded-full bg-red-900/50 text-red-300 border border-red-800/50"
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
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Did this person survive or die?
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => handleGuess(false)}
              className="px-8 py-3 text-lg font-bold rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white transition-colors shadow-lg shadow-emerald-900/30 active:scale-95"
            >
              SURVIVED
            </button>
            <button
              onClick={() => handleGuess(true)}
              className="px-8 py-3 text-lg font-bold rounded-xl bg-red-700 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-900/30 active:scale-95"
            >
              DIED
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
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-100">{value}</p>
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
    <div className="max-w-2xl mx-auto text-center space-y-6 py-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          The Killing Cascade
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Can you predict who survived a police shooting?
        </p>
      </div>

      <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-6 text-left border border-gray-700 space-y-3">
        <p className="text-gray-300 text-sm leading-relaxed">
          Based on <strong className="text-gray-100">2,041 real officer-involved shooting cases</strong> from
          California Department of Justice data (2016&ndash;2024), this interactive presents
          you with case details and asks a simple question: <em>did this person survive?</em>
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Each case shows the victim&rsquo;s wound locations, demographics, and incident
          details. After your guess, you&rsquo;ll see the actual outcome and how it
          compares to a statistical model&rsquo;s prediction from the research paper.
        </p>
        <p className="text-gray-400 text-xs">
          Overall, approximately 59% of people shot by police in this dataset died.
          The statistical model gets about 70% right. Can you do better?
        </p>
      </div>

      <button
        onClick={onStart}
        className="px-10 py-4 text-xl font-bold rounded-xl bg-red-700 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-900/40 active:scale-95"
      >
        Start ({CASES_PER_SESSION} cases)
      </button>

      {totalVisitors !== null && totalVisitors > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {totalVisitors.toLocaleString()} {totalVisitors === 1 ? 'visitor has' : 'visitors have'} taken this challenge
        </p>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        From{' '}
        <a
          href="https://www.crimrxiv.com/pub/7mj8aj3g"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-300"
        >
          &ldquo;The Killing Cascade&rdquo;
        </a>{' '}
        by Justin Nix &amp; Ian T. Adams (2026)
      </p>
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
    <div className={`rounded-xl border-2 p-5 space-y-4 transition-colors ${
      correct
        ? 'border-emerald-500 bg-emerald-950/30'
        : 'border-red-500 bg-red-950/30'
    }`}>
      {/* Outcome banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-black ${
            currentCase.fatal ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {currentCase.fatal ? 'DIED' : 'SURVIVED'}
          </span>
          <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
            correct
              ? 'bg-emerald-800/50 text-emerald-300'
              : 'bg-red-800/50 text-red-300'
          }`}>
            {correct ? 'You got it right' : 'Incorrect'}
          </span>
        </div>
      </div>

      {/* Probability bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Model predicted: {pPct}% chance of death</span>
          <span className={modelAgreed ? 'text-emerald-400' : 'text-amber-400'}>
            {modelAgreed ? 'Model was right' : 'Model was wrong'}
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pPct}%`,
              background: `linear-gradient(90deg, #22c55e ${Math.max(0, 50 - pPct)}%, #ef4444 ${Math.min(100, 50 + pPct)}%)`,
            }}
          />
          {/* 50% marker */}
          <div className="absolute top-0 left-1/2 w-px h-full bg-gray-500 opacity-60" />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Likely survived</span>
          <span>Likely died</span>
        </div>
      </div>

      {/* Odds interpretation */}
      <p className="text-sm text-gray-300">{oddsText}</p>

      {/* Next button */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={submitting}
          className="px-6 py-2 font-semibold rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50"
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
  onPlayAgain,
}: {
  guesses: UserGuess[];
  userScore: number;
  modelScore: number;
  totalCases: number;
  totalVisitors: number | null;
  onPlayAgain: () => void;
}) {
  const userPct = Math.round((userScore / totalCases) * 100);
  const modelPct = Math.round((modelScore / totalCases) * 100);

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
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Results
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {totalCases} cases completed
        </p>
      </div>

      {/* Score comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-5 text-center border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Your Score</p>
          <p className="text-4xl font-black text-gray-100">
            {userScore}<span className="text-lg text-gray-500">/{totalCases}</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">{userPct}% accuracy</p>
        </div>
        <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-5 text-center border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Model Score</p>
          <p className="text-4xl font-black text-gray-100">
            {modelScore}<span className="text-lg text-gray-500">/{totalCases}</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">{modelPct}% accuracy</p>
        </div>
      </div>

      <p className="text-center text-gray-300 font-medium">{verdict}</p>

      {/* Case-by-case breakdown */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-3 py-2 text-left text-gray-400 font-medium">#</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Outcome</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Your Guess</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Model P(death)</th>
            </tr>
          </thead>
          <tbody>
            {guesses.map((g, i) => {
              const correct = g.guessedFatal === g.actualFatal;
              return (
                <tr key={i} className="border-b border-gray-800 last:border-0">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className={`px-3 py-2 font-medium ${g.actualFatal ? 'text-red-400' : 'text-emerald-400'}`}>
                    {g.actualFatal ? 'Died' : 'Survived'}
                  </td>
                  <td className={`px-3 py-2 ${correct ? 'text-emerald-400' : 'text-red-400'}`}>
                    {g.guessedFatal ? 'Died' : 'Survived'}
                    {correct ? ' \u2713' : ' \u2717'}
                  </td>
                  <td className="px-3 py-2 text-gray-300">
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
        <h3 className="font-semibold text-gray-100">Key Finding from the Research</h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          Wound location is the dominant predictor of fatality: being struck in the head/neck
          or chest increases the odds of death by 45&ndash;53x compared to extremity wounds.
          Each additional officer firing increases fatality risk by ~13%, partly through
          a &ldquo;killing cascade&rdquo; where more officers produce more wounds in more lethal locations.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onPlayAgain}
          className="px-8 py-3 text-lg font-bold rounded-xl bg-red-700 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-900/30 active:scale-95"
        >
          Play Again
        </button>

        {totalVisitors !== null && totalVisitors > 0 && (
          <p className="text-sm text-gray-500">
            {totalVisitors.toLocaleString()} visitors have taken this challenge
          </p>
        )}

        <p className="text-xs text-gray-400">
          Read the full paper:{' '}
          <a
            href="https://www.crimrxiv.com/pub/7mj8aj3g"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-300"
          >
            &ldquo;The Killing Cascade&rdquo; (Nix &amp; Adams, 2026)
          </a>
        </p>
      </div>
    </div>
  );
}
