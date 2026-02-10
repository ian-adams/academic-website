import { useState } from 'react';

interface PolicyPreferences {
  selfDirected: 'allow' | 'discourage' | 'prohibit';
  colleaguePositive: 'allow' | 'discourage' | 'prohibit';
  colleagueNegative: 'allow' | 'discourage' | 'prohibit';
  publicDirected: 'allow' | 'discourage' | 'prohibit';
  intentFocus: 'words' | 'intent' | 'both';
  disciplineApproach: 'progressive' | 'zero-tolerance' | 'contextual';
}

const DEFAULT_PREFERENCES: PolicyPreferences = {
  selfDirected: 'allow',
  colleaguePositive: 'discourage',
  colleagueNegative: 'discourage',
  publicDirected: 'prohibit',
  intentFocus: 'intent',
  disciplineApproach: 'progressive',
};

export default function PolicyGenerator() {
  const [preferences, setPreferences] = useState<PolicyPreferences>(DEFAULT_PREFERENCES);
  const [showPolicy, setShowPolicy] = useState(false);
  const [copied, setCopied] = useState(false);

  const updatePreference = <K extends keyof PolicyPreferences>(
    key: K,
    value: PolicyPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const generatePolicy = () => {
    const sections: string[] = [];

    // Header
    sections.push('# DEPARTMENT PROFANITY POLICY');
    sections.push('');
    sections.push('## Purpose');
    sections.push('This policy establishes guidelines for the use of profane language by department personnel, balancing officer expression with professional standards and public trust.');
    sections.push('');

    // Self-directed language
    sections.push('## Section 1: Self-Directed Language');
    if (preferences.selfDirected === 'allow') {
      sections.push('Officers may use profane language when speaking to themselves or about situations, provided such language is not audible to the public. This recognizes that stress relief through private expression can support officer wellbeing without impacting public perception.');
    } else if (preferences.selfDirected === 'discourage') {
      sections.push('While not strictly prohibited, officers are discouraged from using profane language even in private settings. Professional language habits reduce the risk of inadvertent public exposure.');
    } else {
      sections.push('All profane language is prohibited, including self-directed expressions. Officers are expected to maintain professional language standards at all times while on duty.');
    }
    sections.push('');

    // Colleague-directed language
    sections.push('## Section 2: Colleague-Directed Language');
    sections.push('');
    sections.push('### 2.1 Positive/Neutral Context');
    if (preferences.colleaguePositive === 'allow') {
      sections.push('Profane language used in positive or neutral contexts among colleagues (e.g., expressions of camaraderie or emphasis) is permitted when not in public view or earshot.');
    } else if (preferences.colleaguePositive === 'discourage') {
      sections.push('While recognizing informal workplace communication, officers are encouraged to maintain professional language with colleagues. Supervisors should model appropriate language use.');
    } else {
      sections.push('All profane language directed at or around colleagues is prohibited, regardless of intent or context.');
    }
    sections.push('');

    sections.push('### 2.2 Derogatory Context');
    if (preferences.colleagueNegative === 'allow') {
      sections.push('Derogatory profane language toward colleagues is permitted but strongly discouraged as it may create a hostile work environment.');
    } else if (preferences.colleagueNegative === 'discourage') {
      sections.push('Derogatory language toward colleagues, including profanity, is discouraged and may be addressed through counseling or coaching. Patterns of such behavior will be subject to progressive discipline.');
    } else {
      sections.push('Derogatory profane language directed at colleagues is strictly prohibited and will result in disciplinary action. Such language undermines unit cohesion and professional standards.');
    }
    sections.push('');

    // Public-directed language
    sections.push('## Section 3: Public-Directed Language');
    if (preferences.publicDirected === 'allow') {
      sections.push('While not recommended, profane language directed at members of the public is not automatically grounds for discipline. Context, including provocation and officer safety concerns, will be considered.');
    } else if (preferences.publicDirected === 'discourage') {
      sections.push('Officers are strongly discouraged from using profane language when interacting with the public. While isolated incidents may be addressed through counseling, repeated instances will be subject to discipline.');
    } else {
      sections.push('Profane language directed at members of the public is strictly prohibited. Officers must maintain professional communication regardless of citizen behavior or provocation. Violations will result in disciplinary action.');
    }
    sections.push('');

    // Intent vs. words
    sections.push('## Section 4: Evaluation Standards');
    if (preferences.intentFocus === 'words') {
      sections.push('This policy focuses on specific prohibited words rather than intent. The use of designated profane terms constitutes a violation regardless of context or intended meaning.');
    } else if (preferences.intentFocus === 'intent') {
      sections.push('Evaluations under this policy will prioritize intent over specific word choice. Derogatory or demeaning intent, regardless of specific vocabulary, may constitute a violation. Conversely, profanity used without hostile intent may receive more lenient treatment.');
    } else {
      sections.push('Both the specific language used and the intent behind it will be considered when evaluating potential violations. Derogatory intent combined with profane language represents the most serious category of violation.');
    }
    sections.push('');

    // Discipline approach
    sections.push('## Section 5: Disciplinary Framework');
    if (preferences.disciplineApproach === 'zero-tolerance') {
      sections.push('Violations of this policy will result in automatic disciplinary action as follows:');
      sections.push('- First offense: Written reprimand');
      sections.push('- Second offense: Suspension without pay (1-3 days)');
      sections.push('- Third offense: Suspension without pay (5-10 days)');
      sections.push('- Fourth offense: Termination proceedings');
    } else if (preferences.disciplineApproach === 'progressive') {
      sections.push('The department will employ progressive discipline for policy violations:');
      sections.push('- First offense: Verbal counseling and documentation');
      sections.push('- Second offense: Written reprimand');
      sections.push('- Third offense: Suspension consideration');
      sections.push('- Subsequent offenses: Escalating discipline up to termination');
      sections.push('');
      sections.push('Supervisors have discretion to recommend lesser or greater discipline based on circumstances.');
    } else {
      sections.push('Discipline will be determined on a case-by-case basis considering:');
      sections.push('- The target of the language (self, colleague, or public)');
      sections.push('- The intent (positive, neutral, or derogatory)');
      sections.push('- Provocation or threat level');
      sections.push('- Officer\'s disciplinary history');
      sections.push('- Impact on public trust');
      sections.push('');
      sections.push('Supervisors will document their reasoning when recommending discipline.');
    }
    sections.push('');

    // Footer
    sections.push('---');
    sections.push('*Policy generated based on research from Adams (2024) and Adams et al. (2025). This is a template for discussion purposes and should be reviewed by legal counsel before adoption.*');

    return sections.join('\n');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatePolicy());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStrictnessScore = () => {
    let score = 0;

    if (preferences.selfDirected === 'discourage') score += 1;
    if (preferences.selfDirected === 'prohibit') score += 2;

    if (preferences.colleaguePositive === 'discourage') score += 1;
    if (preferences.colleaguePositive === 'prohibit') score += 2;

    if (preferences.colleagueNegative === 'discourage') score += 1;
    if (preferences.colleagueNegative === 'prohibit') score += 2;

    if (preferences.publicDirected === 'discourage') score += 1;
    if (preferences.publicDirected === 'prohibit') score += 2;

    if (preferences.intentFocus === 'words') score += 2;
    if (preferences.intentFocus === 'both') score += 1;

    if (preferences.disciplineApproach === 'zero-tolerance') score += 2;
    if (preferences.disciplineApproach === 'progressive') score += 1;

    return score;
  };

  const getStrictnessLabel = () => {
    const score = getStrictnessScore();
    if (score <= 3) return { label: 'Permissive', color: 'text-green-600 dark:text-green-400' };
    if (score <= 6) return { label: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400' };
    if (score <= 9) return { label: 'Strict', color: 'text-orange-600 dark:text-orange-400' };
    return { label: 'Very Strict', color: 'text-red-600 dark:text-red-400' };
  };

  const strictness = getStrictnessLabel();

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Create Your Policy
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your preferences below to generate a custom profanity policy based on the research findings.
          Your choices will reflect different approaches to balancing officer expression with professional standards.
        </p>
      </div>

      {/* Strictness indicator */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Policy Strictness:
        </span>
        <span className={`text-lg font-bold ${strictness.color}`}>
          {strictness.label}
        </span>
      </div>

      {/* Configuration options */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Self-directed */}
        <fieldset className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <legend className="font-semibold text-gray-900 dark:text-white mb-2">
            Self-Directed Language
          </legend>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            e.g., "Man, I'm such a fuck-up" or "It's a fucking beautiful day"
          </p>
          <div className="space-y-2">
            {(['allow', 'discourage', 'prohibit'] as const).map(option => (
              <label key={option} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="selfDirected"
                  checked={preferences.selfDirected === option}
                  onChange={() => updatePreference('selfDirected', option)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Colleague positive */}
        <fieldset className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <legend className="font-semibold text-gray-900 dark:text-white mb-2">
            Colleague (Positive/Neutral)
          </legend>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            e.g., "Jones, you handled that fucking brilliantly"
          </p>
          <div className="space-y-2">
            {(['allow', 'discourage', 'prohibit'] as const).map(option => (
              <label key={option} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="colleaguePositive"
                  checked={preferences.colleaguePositive === option}
                  onChange={() => updatePreference('colleaguePositive', option)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Colleague negative */}
        <fieldset className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <legend className="font-semibold text-gray-900 dark:text-white mb-2">
            Colleague (Derogatory)
          </legend>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            e.g., "Jones, you're a real fuck-up sometimes"
          </p>
          <div className="space-y-2">
            {(['allow', 'discourage', 'prohibit'] as const).map(option => (
              <label key={option} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="colleagueNegative"
                  checked={preferences.colleagueNegative === option}
                  onChange={() => updatePreference('colleagueNegative', option)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Public-directed */}
        <fieldset className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <legend className="font-semibold text-gray-900 dark:text-white mb-2">
            Public-Directed Language
          </legend>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            e.g., "Stop acting like a fucking idiot"
          </p>
          <div className="space-y-2">
            {(['allow', 'discourage', 'prohibit'] as const).map(option => (
              <label key={option} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="publicDirected"
                  checked={preferences.publicDirected === option}
                  onChange={() => updatePreference('publicDirected', option)}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Intent focus */}
        <fieldset className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <legend className="font-semibold text-gray-900 dark:text-white mb-2">
            Evaluation Focus
          </legend>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            What should policy evaluations prioritize?
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="intentFocus"
                checked={preferences.intentFocus === 'words'}
                onChange={() => updatePreference('intentFocus', 'words')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Specific words used</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="intentFocus"
                checked={preferences.intentFocus === 'intent'}
                onChange={() => updatePreference('intentFocus', 'intent')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Intent behind language</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="intentFocus"
                checked={preferences.intentFocus === 'both'}
                onChange={() => updatePreference('intentFocus', 'both')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Both words and intent</span>
            </label>
          </div>
        </fieldset>

        {/* Discipline approach */}
        <fieldset className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <legend className="font-semibold text-gray-900 dark:text-white mb-2">
            Discipline Approach
          </legend>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            How should violations be handled?
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="disciplineApproach"
                checked={preferences.disciplineApproach === 'contextual'}
                onChange={() => updatePreference('disciplineApproach', 'contextual')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Contextual (case-by-case)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="disciplineApproach"
                checked={preferences.disciplineApproach === 'progressive'}
                onChange={() => updatePreference('disciplineApproach', 'progressive')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Progressive discipline</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="disciplineApproach"
                checked={preferences.disciplineApproach === 'zero-tolerance'}
                onChange={() => updatePreference('disciplineApproach', 'zero-tolerance')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Zero tolerance</span>
            </label>
          </div>
        </fieldset>
      </div>

      {/* Generate button */}
      <div className="text-center">
        <button
          onClick={() => setShowPolicy(true)}
          className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg rounded-lg transition-colors"
        >
          Generate Policy Document
        </button>
      </div>

      {/* Generated policy */}
      {showPolicy && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-bold text-gray-900 dark:text-white">Generated Policy</h3>
            <button
              onClick={copyToClipboard}
              className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
          <div className="p-6 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono">
              {generatePolicy()}
            </pre>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Note:</strong> This policy generator is for educational and discussion purposes only.
          Any policy adopted by a law enforcement agency should be reviewed by legal counsel and adapted
          to local laws, union agreements, and departmental needs.
        </p>
      </div>
    </div>
  );
}
