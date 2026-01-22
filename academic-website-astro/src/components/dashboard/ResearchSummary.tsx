import { useState, useEffect } from 'react';

export default function ResearchSummary() {
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Introduction */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white p-8 rounded-lg">
        <h2 className="text-2xl font-serif font-bold mb-4">The Science Behind the Dashboard</h2>
        <p className="text-purple-100 leading-relaxed">
          This dashboard is built on two peer-reviewed studies published in <em>Police Quarterly</em>,
          one of the leading journals in policing research. Together, they explore a question that
          might seem trivial but has real implications for police policy and public trust:
          <strong> How do people judge police officers who use profanity?</strong>
        </p>
      </div>

      {/* Study 1 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-purple-100 dark:bg-purple-900/30 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300">Study 1</h3>
          <p className="text-sm text-purple-600 dark:text-purple-400 font-mono">
            "Fuck: The Police" (2024)
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Police Quarterly</span>
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">n = 1,492 executives (5,280 observations)</span>
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">All 50 US states</span>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What was the question?</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Police officers use profanity. A lot. But how do police leaders think about profanity in
              their ranks? When is it acceptable, and when does it cross the line?
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What did we do?</h4>
            <p className="text-gray-600 dark:text-gray-400">
              We surveyed nearly 1,500 law enforcement executives (72%) and HR directors (25%) from agencies
              across all 50 US states. With an average of 27.5 years of professional experience, these leaders
              rated realistic scenarios of officers using profanity. We also documented 50 different "fuck"
              derivatives commonly used in police culture—that's where The Fuckulator quiz comes from.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What did we find?</h4>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                <span><strong>Target matters most.</strong> Executives were far more tolerant of profanity
                directed at oneself or colleagues than profanity directed at the public.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                <span><strong>Intent matters too.</strong> Derogatory language ("you're a fuck-up") was
                judged more harshly than positive ("fucking great job") or neutral uses.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                <span><strong>Context is everything.</strong> The same word can be acceptable or
                unacceptable depending on who hears it and why it's being said.</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Full citation:</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Adams, I. T. (2024). Fuck: The Police. <em>Police Quarterly, 28</em>(1), 10986111241241750.
            </p>
            <a
              href="https://doi.org/10.1177/10986111241241750"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium"
            >
              Read the full paper
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Study 2 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-purple-100 dark:bg-purple-900/30 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300">Study 2</h3>
          <p className="text-sm text-purple-600 dark:text-purple-400 font-mono">
            "Fuck: Public Opinion" (2025)
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Police Quarterly</span>
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">n = 2,412 adults</span>
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">South Carolina sample</span>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What was the question?</h4>
            <p className="text-gray-600 dark:text-gray-400">
              We knew what police executives thought. But what about the public? After all, it's the
              public who police serve, and public trust is essential to effective policing.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What did we do?</h4>
            <p className="text-gray-600 dark:text-gray-400">
              We surveyed over 2,400 South Carolina residents, drawn from a commercial household listserv.
              We used the same scenarios from Study 1, allowing us to directly compare how the public and
              executives judge the same behaviors. We also looked at how demographics (age, race, gender,
              political affiliation) predict people's judgments.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What did we find?</h4>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                <span><strong>The public agrees: target matters.</strong> Just like executives, regular
                Americans judge public-directed profanity far more harshly than internal profanity.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                <span><strong>Executives are more lenient internally.</strong> Police leaders are more
                accepting of profanity among officers than the public is—but both groups agree that
                swearing at citizens is unprofessional.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                <span><strong>Demographics predict judgments.</strong> Women, non-white respondents, and
                Democrats tend to judge police profanity more harshly. Republicans and higher-income
                respondents are somewhat more accepting.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                <span><strong>Most people want some discipline.</strong> Even for the most "acceptable"
                scenarios, the public still thinks some corrective action is warranted.</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Full citation:</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Adams, I. T., Olson, M., James, L., Tregle, B., & Boehme, H. M. (2025). Fuck: Public Opinion.
              <em>Police Quarterly</em>, 10986111251357508.
            </p>
            <a
              href="https://doi.org/10.1177/10986111251357508"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium"
            >
              Read the full paper
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Why it matters */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
        <h3 className="text-xl font-serif font-bold text-gray-900 dark:text-white mb-4">
          Why Does This Matter?
        </h3>
        <div className="space-y-4 text-gray-600 dark:text-gray-400">
          <p>
            Police profanity might seem like a minor issue compared to use of force, misconduct, or
            procedural justice. But language is one of the most frequent ways officers interact with
            the public, and those interactions shape trust.
          </p>
          <p>
            These studies show that both the public and police leadership care about professional
            language—but they also reveal important nuances. A blanket "no profanity" policy might be
            unrealistic given police culture. A more targeted approach that focuses on <em>who</em> hears
            the language and <em>why</em> it's being used could be more effective.
          </p>
          <p>
            The fact that executives and the public largely agree on what's unacceptable (swearing at
            citizens) suggests there's common ground for policy. But the gap in tolerance for internal
            profanity means departments should be thoughtful about how they communicate expectations.
          </p>
        </div>
      </div>

      {/* The bigger picture */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-serif font-bold text-gray-900 dark:text-white mb-4">
          The Bigger Picture
        </h3>
        <div className="space-y-4 text-gray-600 dark:text-gray-400">
          <p>
            This research is part of a broader effort to understand police culture and its effects on
            public trust. By studying something as everyday as language, we can gain insights into how
            police departments function internally and how they're perceived externally.
          </p>
          <p>
            The interactive tools in this dashboard let you explore the data yourself. You can see how
            your own judgments compare to the research samples, understand the patterns in the data, and
            even generate a custom policy based on your preferences.
          </p>
          <p className="font-medium text-gray-900 dark:text-white">
            Science doesn't have to be dry. Sometimes, it can be fucking interesting.
          </p>
        </div>
      </div>

      {/* Author info */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-purple-200 dark:bg-purple-800 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-serif font-bold text-purple-700 dark:text-purple-300">IA</span>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white">Ian T. Adams, Ph.D.</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Assistant Professor, Department of Criminology & Criminal Justice<br />
              University of South Carolina
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Dr. Adams studies policing, with a focus on technology, policy, and officer behavior.
              His work has been published in top journals including <em>Criminology</em>, <em>Justice
              Quarterly</em>, and <em>Public Administration Review</em>.
            </p>
            <a
              href="https://ianadamsresearch.com"
              className="inline-flex items-center gap-1 mt-3 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium"
            >
              Learn more about the research
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
