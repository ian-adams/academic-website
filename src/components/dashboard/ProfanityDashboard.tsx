import { useState, useEffect, lazy, Suspense } from 'react';

// Lazy load components
const FuckulatorQuiz = lazy(() => import('./FuckulatorQuiz'));
const JudgmentQuiz = lazy(() => import('./JudgmentQuiz'));
const TargetIntentExplorer = lazy(() => import('./TargetIntentExplorer'));
const PublicVsExecutive = lazy(() => import('./PublicVsExecutive'));
const DemographicExplorer = lazy(() => import('./DemographicExplorer'));
const PolicyGenerator = lazy(() => import('./PolicyGenerator'));
const ResearchSummary = lazy(() => import('./ResearchSummary'));

type Tab = 'fuckulator' | 'judgment' | 'explorer' | 'comparison' | 'demographics' | 'policy' | 'research';

interface TabInfo {
  id: Tab;
  label: string;
  shortLabel: string;
  description: string;
}

const TABS: TabInfo[] = [
  {
    id: 'fuckulator',
    label: 'The Fuckulator',
    shortLabel: 'Quiz 1',
    description: 'Test your knowledge of police profanity slang',
  },
  {
    id: 'judgment',
    label: 'Judgment Quiz',
    shortLabel: 'Quiz 2',
    description: 'Rate scenarios and compare to other respondents',
  },
  {
    id: 'explorer',
    label: 'Target × Intent',
    shortLabel: 'Explorer',
    description: 'Explore how target and intent affect judgments',
  },
  {
    id: 'comparison',
    label: 'Public vs. Police',
    shortLabel: 'Compare',
    description: 'See how the public and police executives differ',
  },
  {
    id: 'demographics',
    label: 'Demographics',
    shortLabel: 'Demographics',
    description: 'Who judges police profanity most harshly?',
  },
  {
    id: 'policy',
    label: 'Policy Generator',
    shortLabel: 'Policy',
    description: 'Create a custom profanity policy',
  },
  {
    id: 'research',
    label: 'The Research',
    shortLabel: 'Research',
    description: 'Learn about the science behind the dashboard',
  },
];

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
  </div>
);

export default function ProfanityDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('fuckulator');
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

  const activeTabInfo = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <header className="border-b-4 border-purple-600 pb-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-12 bg-purple-600"></div>
          <span className="text-sm font-bold tracking-widest uppercase text-purple-600">
            Interactive Research Dashboard
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gray-900 dark:text-white leading-tight mb-2">
          Police Profanity<br />
          <span className="text-purple-600">Judgment Dashboard</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 italic mb-4">
          What the fuck do you know about police profanity?
        </p>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl font-light leading-relaxed">
          Explore how police profanity is judged based on its <strong>target</strong> and <strong>intent</strong>,
          drawing from survey data of executives and the public.
        </p>
        <div className="flex flex-wrap items-center gap-6 mt-6 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
            Based on Adams (2024) &amp; Adams et al. (2025)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
            n = 2,412 public + 1,492 executives
          </span>
        </div>
      </header>

      {/* Navigation Tabs - Desktop */}
      <nav className="hidden md:flex border-b border-gray-200 dark:border-gray-700 mb-8 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 lg:px-6 py-4 text-sm font-semibold tracking-wide uppercase transition-colors relative whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600"></div>
            )}
          </button>
        ))}
      </nav>

      {/* Navigation Tabs - Mobile */}
      <nav className="md:hidden mb-6">
        <div className="flex overflow-x-auto gap-2 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {tab.shortLabel}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab description */}
      {activeTabInfo && (
        <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white mb-2">
            {activeTabInfo.label}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {activeTabInfo.description}
          </p>
        </div>
      )}

      {/* Tab Content */}
      <div className="pb-12">
        <Suspense fallback={<LoadingSpinner />}>
          {activeTab === 'fuckulator' && <FuckulatorQuiz />}
          {activeTab === 'judgment' && <JudgmentQuiz />}
          {activeTab === 'explorer' && <TargetIntentExplorer />}
          {activeTab === 'comparison' && <PublicVsExecutive />}
          {activeTab === 'demographics' && <DemographicExplorer />}
          {activeTab === 'policy' && <PolicyGenerator />}
          {activeTab === 'research' && <ResearchSummary />}
        </Suspense>
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Citations */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Based on Research
            </h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <p>
                Adams, I. T. (2024). Fuck: The Police. <em>Police Quarterly, 28</em>(1).{' '}
                <a
                  href="https://doi.org/10.1177/10986111241241750"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  doi.org/10.1177/10986111241241750
                </a>
              </p>
              <p>
                Adams, I. T., Olson, M., James, L., Tregle, B., &amp; Boehme, H. M. (2025). Fuck: Public Opinion.{' '}
                <em>Police Quarterly</em>.{' '}
                <a
                  href="https://doi.org/10.1177/10986111251357508"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  doi.org/10.1177/10986111251357508
                </a>
              </p>
            </div>
          </div>

          {/* Key findings summary */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Key Findings
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-1.5 flex-shrink-0"></span>
                Target matters most: public-directed profanity is judged most harshly
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-1.5 flex-shrink-0"></span>
                Intent has smaller but meaningful effects on judgments
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-1.5 flex-shrink-0"></span>
                Police executives are more accepting of internal profanity
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500 dark:text-gray-400 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            Interactive analysis by{' '}
            <a href="https://ianadamsresearch.com" className="text-purple-600 hover:underline">
              Ian T. Adams, Ph.D.
            </a>
            , University of South Carolina
          </div>
          <div className="text-xs">
            For educational and research purposes. Data from peer-reviewed survey research.
          </div>
        </div>
      </footer>
    </div>
  );
}
