const projects = [
  {
    id: 'lovebud',
    name: 'LoveBud',
    description: 'Personal tree-based social platform with browse, editor, viewer, and my-trees',
    tasks: {
      'lb-auth-audit': {
        done: false,
        evidence: '#3425 OPEN — architecture audit in progress'
      },
      'lb-migration-ledger': {
        done: false,
        evidence: '#3458 OPEN — migration ledger and provenance gate incomplete'
      },
      'lb-provenance-gate': {
        done: false,
        evidence: '#3458 OPEN — provenance gate incomplete'
      },
      'lb-auth-css-cache': {
        done: true,
        evidence: '#3451 CLOSED/COMPLETED — auth CSS cache busting'
      },
      'lb-tree-owner-binding': {
        done: true,
        evidence: '#3481 CLOSED/COMPLETED — tree owner binding'
      },
      'lb-scout-target-tree': {
        done: true,
        evidence: 'PR #3531 merge commit e0ff1b2a4089c31fe4adb3e9c082ef9a4499a1cf'
      }
    },
    developmentMode: 'active-development',
    currentMilestone: ['#3425', '#3458'],
    futureRoadmap: [],
    blockers: []
  },
  {
    id: 'living-fiction',
    name: 'Living Fiction',
    description: 'Interactive fiction deployment and re-verification platform',
    tasks: {
      'lf-deployment-reverification': {
        done: true,
        evidence: 'Issue #140 Living Fiction deployment re-verification contract'
      }
    },
    developmentMode: 'maintenance',
    currentMilestone: [],
    futureRoadmap: [],
    blockers: []
  },
  {
    id: 'living-travel',
    name: 'Living Travel',
    description: 'AI-powered travel companion with itinerary generation',
    tasks: {
      'lt-local-provider-spike': {
        done: true,
        evidence: 'Issue #107 comment 5071926646 — local provider spike succeeded'
      },
      'lt-remote-commit': {
        done: false,
        evidence: 'Remote commit/PR pending; full workflow not complete'
      },
      'lt-production': {
        done: false,
        evidence: ''
      }
    },
    developmentMode: 'active-development',
    currentMilestone: ['#107'],
    futureRoadmap: [],
    blockers: ['Remote commit/PR pending']
  },
  {
    id: 'ai-finder',
    name: 'AI Finder / Bukgu',
    description: 'Municipal AI assistant for Bukgu district with citizen services',
    tasks: {
      'af-official-source-freshness': {
        done: false,
        evidence: '#1150 OPEN — official source freshness'
      },
      'af-page-agent-parity': {
        done: false,
        evidence: '#1080 OPEN — page agent parity integration'
      }
    },
    developmentMode: 'active-development',
    currentMilestone: ['#1150', '#1080'],
    futureRoadmap: ['#1181 planning-only/deferred — crawl filter hardening'],
    blockers: ['#1181 deferred']
  },
  {
    id: 'personal-edition',
    name: 'Personal Edition',
    description: 'Personal portfolio and productivity suite',
    tasks: {
      'pe-implementation': {
        done: true,
        evidence: 'PR #111 head 3f44ac725c1b946776ae41d3b25bc8c2d56df626'
      },
      'pe-ctoreview': {
        done: false,
        evidence: ''
      },
      'pe-merge': {
        done: false,
        evidence: ''
      },
      'pe-production': {
        done: false,
        evidence: ''
      }
    },
    developmentMode: 'draft-pr',
    currentMilestone: ['PR #111'],
    futureRoadmap: ['CTO review', 'Merge', 'Production deployment'],
    blockers: ['PR #111 is OPEN Draft, mergeable: false']
  },
  {
    id: 'korean-ai-platform',
    name: 'Korean AI Platform',
    description: 'Korean-language AI platform with revenue lab integration',
    tasks: {
      'kap-learning-phase1': {
        done: false,
        evidence: '#138 OPEN — learning phase 1 in progress'
      },
      'kap-production-deployment': {
        done: false,
        evidence: ''
      }
    },
    developmentMode: 'active-development',
    currentMilestone: ['#138'],
    futureRoadmap: [],
    blockers: []
  },
  {
    id: 'personal-video-archive',
    name: 'Personal Video Archive',
    description: 'Personal video archiving and streaming platform',
    tasks: {
      'pva-storage-setup': {
        done: true,
        evidence: 'Storage configured and operational'
      },
      'pva-ui-implementation': {
        done: false,
        evidence: ''
      }
    },
    developmentMode: 'active-development',
    currentMilestone: [],
    futureRoadmap: ['UI implementation'],
    blockers: []
  },
  {
    id: 'ai-revenue-lab',
    name: 'AI Revenue Lab',
    description: 'AI-powered revenue optimization and analytics platform',
    tasks: {
      'arl-travel-phase2': {
        done: false,
        evidence: '#96 OPEN — travel phase 2 in progress'
      },
      'arl-ui-main': {
        done: false,
        evidence: ''
      }
    },
    developmentMode: 'active-development',
    currentMilestone: ['#96'],
    futureRoadmap: [],
    blockers: []
  },
  {
    id: 'lovetree3',
    name: 'LoveTree 3.0',
    description: 'Next-generation LoveTree platform with enhanced features',
    tasks: {
      'lt3-media-search': {
        done: false,
        evidence: 'Media search worktree active'
      },
      'lt3-production': {
        done: false,
        evidence: ''
      }
    },
    developmentMode: 'planning',
    currentMilestone: [],
    futureRoadmap: ['Media search', 'Production deployment'],
    blockers: []
  }
];

const undefinedProjects = [
  {
    id: 'lovebud-gallery',
    name: 'LoveBud Gallery',
    description: 'Gallery extension for LoveBud platform',
    tasks: {},
    developmentMode: 'unknown',
    currentMilestone: [],
    futureRoadmap: [],
    blockers: []
  },
  {
    id: 'love-match-making',
    name: '401 Love Match Making',
    description: 'AI-powered love match making service',
    tasks: {},
    developmentMode: 'unknown',
    currentMilestone: [],
    futureRoadmap: [],
    blockers: []
  },
  {
    id: 'music-composer',
    name: '238 Music Composer',
    description: 'AI-powered music composition tool',
    tasks: {},
    developmentMode: 'unknown',
    currentMilestone: [],
    futureRoadmap: [],
    blockers: []
  },
  {
    id: 'cwtree',
    name: 'CWTree',
    description: 'Collaborative work tree platform',
    tasks: {},
    developmentMode: 'unknown',
    currentMilestone: [],
    futureRoadmap: [],
    blockers: []
  }
];

export { projects, undefinedProjects };
