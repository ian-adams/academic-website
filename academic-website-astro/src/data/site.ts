export const siteConfig = {
  name: 'Ian T. Adams, Ph.D.',
  title: 'Ian T. Adams Research',
  description: 'Dr. Ian T. Adams is a leading policing scholar at the University of South Carolina. Research on police use of force, body-worn cameras, AI in policing, and police accountability. Publications and resources for criminologists, law enforcement executives, and Section 1983 litigation attorneys.',
  url: 'https://ianadamsresearch.com',
  author: {
    name: 'Ian T. Adams, Ph.D.',
    email: 'ian.adams@sc.edu',
    role: 'Assistant Professor, Department of Criminology & Criminal Justice',
    institution: 'University of South Carolina',
    institutionUrl: 'https://www.sc.edu/study/colleges_schools/artsandsciences/criminology_and_criminal_justice/our_people/directory/adams_ian.php',
    bio: `Ian T. Adams is a leading scholar of policing. He is an Assistant Professor in the Department of Criminology & Criminal Justice at the University of South Carolina. His applied research focuses on the practical concerns of police practitioners, with a specific interest in technology, policy, behavior, and use-of-force in law enforcement.

Dr. Adams has over fifty peer-reviewed publications on these and related topics, and his work has been published in the top general interest journals of both criminal justice and public administration, including Criminology, Justice Quarterly, Criminology & Public Policy, and Public Administration Review. He is the recipient of the 2024 Early Career Award from the American Society of Criminology, Division of Policing, the 2025 Early Career Award from the Division of Experimental Criminology, and the 2026 Emerging Scholar Award from the Police Section of the Academy of Criminal Justice Sciences.`,
    education: [
      { degree: 'Ph.D. Political Science', institution: 'University of Utah', year: 2022 },
      { degree: 'Masters of Public Administration', institution: 'University of Utah', year: 2017 },
      { degree: 'BS in Marketing', institution: 'University of Utah', year: 2003 },
    ],
    interests: [
      'Police Practices & Behavior',
      'Human Capital in Policing',
      'Body-Worn Cameras & Technology',
      'Artificial Intelligence in Policing',
    ],
    social: {
      twitter: 'https://twitter.com/ian_t_adams',
      googleScholar: 'https://scholar.google.com/citations?user=g9lY5RUAAAAJ&hl',
      github: 'https://github.com/ian-adams',
      researchGate: 'https://www.researchgate.net/profile/Ian_Adams11',
    },
    avatar: '/media/avatar.jpg',
    cv: '/media/cv.pdf',
  },
  nav: [
    { name: 'Home', href: '/' },
    { name: 'Publications', href: '/publications' },
    { name: 'Posts', href: '/posts' },
    {
      name: 'Dashboards',
      items: [
        { name: 'MPV Analysis', href: '/dashboard' },
        { name: 'Bad Apples Simulator', href: '/dashboard/bad-apples' },
        { name: 'Disparity Benchmarks', href: '/dashboard/disparity-benchmarks' },
        { name: 'FCWC Risk Calculator', href: '/dashboard/fcwc-risk' },
        { name: 'Police Profanity', href: '/dashboard/profanity' },
      ],
    },
    {
      name: 'News Feeds',
      items: [
        { name: 'AI in Policing', href: '/ai-news' },
        { name: 'K9 Incidents', href: '/k9-incidents' },
        { name: 'Force Science', href: '/force-science-news' },
        { name: 'Media Mentions', href: '/media' },
      ],
    },
    { name: 'CV', href: '/media/cv.pdf', external: true },
  ],
};

export type SiteConfig = typeof siteConfig;
