import { useState, useEffect, useMemo } from 'react';

interface Term {
  term: string;
  definition: string;
}

interface TermsData {
  terms: Term[];
  correctResponses: string[];
  incorrectResponses: string[];
}

interface QuizQuestion {
  term: Term;
  options: string[];
  correctIndex: number;
}

interface TermStats {
  correct: number;
  incorrect: number;
}

interface AllStats {
  [term: string]: TermStats;
}

const STATS_KEY = 'fuckulator-stats';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function loadStats(): AllStats {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STATS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveStats(stats: AllStats) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}

function recordAnswer(term: string, correct: boolean) {
  const stats = loadStats();
  if (!stats[term]) {
    stats[term] = { correct: 0, incorrect: 0 };
  }
  if (correct) {
    stats[term].correct++;
  } else {
    stats[term].incorrect++;
  }
  saveStats(stats);
}

export default function FuckulatorQuiz() {
  const [termsData, setTermsData] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<AllStats>({});
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setStats(loadStats());
  }, [showStats]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/data/profanity/fuckulator-terms.json');
        if (!response.ok) throw new Error('Failed to fetch terms');
        const data = await response.json();
        setTermsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quiz data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const generateQuestions = (count: number): QuizQuestion[] => {
    if (!termsData) return [];

    const selectedTerms = shuffleArray(termsData.terms).slice(0, count);

    return selectedTerms.map(term => {
      const otherDefinitions = termsData.terms
        .filter(t => t.term !== term.term)
        .map(t => t.definition);
      const wrongOptions = shuffleArray(otherDefinitions).slice(0, 3);

      const correctIndex = Math.floor(Math.random() * 4);
      const options: string[] = [];
      let wrongIndex = 0;

      for (let i = 0; i < 4; i++) {
        if (i === correctIndex) {
          options.push(term.definition);
        } else {
          options.push(wrongOptions[wrongIndex++]);
        }
      }

      return { term, options, correctIndex };
    });
  };

  const startQuiz = () => {
    const newQuestions = generateQuestions(questionCount);
    setQuestions(newQuestions);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setQuizComplete(false);
    setQuizStarted(true);
    setShowStats(false);
    setFeedbackMessage('');
  };

  const handleAnswer = (index: number) => {
    if (showResult || !termsData) return;

    setSelectedAnswer(index);
    setShowResult(true);

    const isCorrect = index === questions[currentQuestion].correctIndex;
    const termName = questions[currentQuestion].term.term;

    // Record the answer
    recordAnswer(termName, isCorrect);

    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedbackMessage(getRandomItem(termsData.correctResponses));
    } else {
      setFeedbackMessage(getRandomItem(termsData.incorrectResponses));
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setFeedbackMessage('');
    } else {
      setQuizComplete(true);
      setStats(loadStats()); // Refresh stats
    }
  };

  const getScoreMessage = () => {
    const percentage = (score / questions.length) * 100;
    if (percentage === 100) return "Holy fucking shit! Perfect score!";
    if (percentage >= 80) return "Fucking impressive!";
    if (percentage >= 60) return "Not fucking bad!";
    if (percentage >= 40) return "You need to get your shit together.";
    return "What the fuck was that? Try again!";
  };

  const getScoreEmoji = () => {
    const percentage = (score / questions.length) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🔥";
    if (percentage >= 60) return "👍";
    if (percentage >= 40) return "😬";
    return "💩";
  };

  const sortedStats = useMemo(() => {
    if (!termsData) return [];

    return termsData.terms.map(term => {
      const termStats = stats[term.term] || { correct: 0, incorrect: 0 };
      const total = termStats.correct + termStats.incorrect;
      const rate = total > 0 ? (termStats.correct / total) * 100 : null;
      return {
        term: term.term,
        definition: term.definition,
        correct: termStats.correct,
        incorrect: termStats.incorrect,
        total,
        rate,
      };
    }).sort((a, b) => {
      // Sort by total attempts descending, then by term name
      if (b.total !== a.total) return b.total - a.total;
      return a.term.localeCompare(b.term);
    });
  }, [termsData, stats]);

  const overallStats = useMemo(() => {
    const totalCorrect = Object.values(stats).reduce((sum, s) => sum + s.correct, 0);
    const totalIncorrect = Object.values(stats).reduce((sum, s) => sum + s.incorrect, 0);
    const total = totalCorrect + totalIncorrect;
    return {
      totalCorrect,
      totalIncorrect,
      total,
      rate: total > 0 ? (totalCorrect / total) * 100 : 0,
      termsAttempted: Object.keys(stats).length,
    };
  }, [stats]);

  const hardestTerms = useMemo(() => {
    return sortedStats
      .filter(s => s.total >= 3) // Only include terms with at least 3 attempts
      .sort((a, b) => (a.rate ?? 100) - (b.rate ?? 100))
      .slice(0, 5);
  }, [sortedStats]);

  const easiestTerms = useMemo(() => {
    return sortedStats
      .filter(s => s.total >= 3)
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
      .slice(0, 5);
  }, [sortedStats]);

  const clearStats = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STATS_KEY);
      setStats({});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // Stats view
  if (showStats) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">
            Your Fuckulator Stats
          </h2>
          <button
            onClick={() => setShowStats(false)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
          >
            Back to Quiz
          </button>
        </div>

        {overallStats.total === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No stats yet! Take the quiz to start tracking your performance.
            </p>
            <button
              onClick={() => setShowStats(false)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              Start Quiz
            </button>
          </div>
        ) : (
          <>
            {/* Overall stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">{overallStats.total}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Answers</div>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{overallStats.totalCorrect}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Correct</div>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{overallStats.totalIncorrect}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Incorrect</div>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{overallStats.rate.toFixed(0)}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Accuracy</div>
              </div>
            </div>

            {/* Hardest and easiest terms */}
            <div className="grid md:grid-cols-2 gap-6">
              {hardestTerms.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-red-600 mb-4">Hardest Terms</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Terms you miss most often (min. 3 attempts)
                  </p>
                  <div className="space-y-3">
                    {hardestTerms.map((term, i) => (
                      <div key={term.term} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {i + 1}. {term.term}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {term.correct}/{term.total} correct
                          </div>
                        </div>
                        <div className={`text-lg font-bold ml-4 ${
                          (term.rate ?? 0) < 50 ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {term.rate?.toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {easiestTerms.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-600 mb-4">Easiest Terms</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Terms you nail most often (min. 3 attempts)
                  </p>
                  <div className="space-y-3">
                    {easiestTerms.map((term, i) => (
                      <div key={term.term} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {i + 1}. {term.term}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {term.correct}/{term.total} correct
                          </div>
                        </div>
                        <div className="text-lg font-bold text-green-600 ml-4">
                          {term.rate?.toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Full term breakdown */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Terms</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {overallStats.termsAttempted} of {termsData?.terms.length || 50} attempted
                </span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Term</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Correct</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Wrong</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedStats.map(term => (
                      <tr key={term.term} className={term.total === 0 ? 'opacity-50' : ''}>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{term.term}</td>
                        <td className="px-4 py-2 text-center text-sm text-green-600">{term.correct}</td>
                        <td className="px-4 py-2 text-center text-sm text-red-600">{term.incorrect}</td>
                        <td className="px-4 py-2 text-center text-sm">
                          {term.rate !== null ? (
                            <span className={
                              term.rate >= 80 ? 'text-green-600' :
                              term.rate >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }>
                              {term.rate.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Clear stats button */}
            <div className="text-center">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all your stats? This cannot be undone.')) {
                    clearStats();
                  }
                }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                Clear all stats
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Start screen
  if (!quizStarted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-serif font-bold text-gray-900 dark:text-white mb-4">
            The Fuckulator
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Test your knowledge of police profanity slang. Match each term with its correct definition.
            Based on 50 "fuck" derivatives documented in Adams (2024).
          </p>

          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Number of Questions
            </label>
            <div className="flex justify-center gap-2">
              {[5, 10, 15, 20].map(num => (
                <button
                  key={num}
                  onClick={() => setQuestionCount(num)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    questionCount === num
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={startQuiz}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg rounded-lg transition-colors"
            >
              Let's Fucking Go!
            </button>
            {overallStats.total > 0 && (
              <button
                onClick={() => setShowStats(true)}
                className="px-8 py-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold text-lg rounded-lg transition-colors"
              >
                View Stats
              </button>
            )}
          </div>

          {overallStats.total > 0 && (
            <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              You've answered {overallStats.total} questions ({overallStats.rate.toFixed(0)}% accuracy)
            </div>
          )}
        </div>
      </div>
    );
  }

  // Quiz complete screen
  if (quizComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">{getScoreEmoji()}</div>
          <h2 className="text-3xl font-serif font-bold text-gray-900 dark:text-white mb-4">
            Quiz Complete!
          </h2>
          <div className="text-5xl font-bold text-purple-600 mb-4">
            {score} / {questions.length}
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
            {getScoreMessage()}
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-500 mb-8">
            {((score / questions.length) * 100).toFixed(0)}% correct
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={startQuiz}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              Play Again
            </button>
            <button
              onClick={() => setShowStats(true)}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors"
            >
              View Stats
            </button>
            <button
              onClick={() => setQuizStarted(false)}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors"
            >
              Change Settings
            </button>
          </div>

          {/* Quick stats summary */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Overall Performance</div>
            <div className="flex justify-center gap-6">
              <div>
                <span className="text-2xl font-bold text-purple-600">{overallStats.total}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">total</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-green-600">{overallStats.rate.toFixed(0)}%</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">accuracy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active quiz
  const question = questions[currentQuestion];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <span>Score: {score}</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Term header */}
        <div className="bg-purple-600 text-white p-6">
          <div className="text-sm font-bold uppercase tracking-wide mb-2 opacity-75">
            What does this mean?
          </div>
          <div className="text-3xl font-bold font-serif">
            {question.term.term}
          </div>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {question.options.map((option, index) => {
            let buttonClass = 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300';

            if (showResult) {
              if (index === question.correctIndex) {
                buttonClass = 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-800 dark:text-green-300';
              } else if (index === selectedAnswer && index !== question.correctIndex) {
                buttonClass = 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-800 dark:text-red-300';
              } else {
                buttonClass = 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 opacity-50';
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={showResult}
                className={`w-full p-4 text-left border-2 rounded-lg transition-all ${buttonClass} ${
                  !showResult ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {showResult && (
          <div className={`p-6 border-t ${
            selectedAnswer === question.correctIndex
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className={`text-xl font-bold mb-2 ${
              selectedAnswer === question.correctIndex
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            }`}>
              {feedbackMessage}
            </div>
            {selectedAnswer !== question.correctIndex && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Correct answer:</strong> {question.term.definition}
              </div>
            )}

            <button
              onClick={nextQuestion}
              className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              {currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
