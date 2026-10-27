export interface Dictionary {
	siteTitle: string;
	nav: {
		journal: string;
		archive: string;
		explore: string;
	};
	home: {
		latestEntry: string;
		currentChapter: string;
		exploreMap: string;
		chooseYourTrebler: string;
	};
	explore: {
		title: string;
		nonMapAlternative: string;
		openMap: string;
		closeMap: string;
	};
	entry: {
		previous: string;
		next: string;
		translationNote: string;
	};
	archive: {
		title: string;
		filterAll: string;
		filterLife: string;
		filterSchool: string;
		filterTrip: string;
	};
	journal: {
		title: string;
		older: string;
		newer: string;
	};
	common: {
		noEntries: string;
	};
	languageToggle: {
		da: string;
		en: string;
	};
	// Database values stay public/family/private (OVERNIGHT.md brand decision
	// 6) - these are UI labels only, shown with an icon, never colour alone.
	visibility: {
		public: string;
		family: string;
		private: string;
	};
	follow: {
		gatedTitle: string;
		gatedBody: string;
		emailLabel: string;
		emailPlaceholder: string;
		requestButton: string;
		requestSent: string;
		codeLabel: string;
		codePlaceholder: string;
		verifyButton: string;
		verifyError: string;
		pending: string;
		reload: string;
		genericError: string;
	};
}

export const en: Dictionary = {
	siteTitle: 'Exchange year',
	nav: {
		journal: 'Journal',
		archive: 'Archive',
		explore: 'Explore'
	},
	home: {
		latestEntry: 'Latest entry',
		currentChapter: 'Current chapter',
		exploreMap: 'Explore map',
		chooseYourTrebler: 'Choose your TREBLEr'
	},
	explore: {
		title: 'Explore the route',
		nonMapAlternative: 'Prefer no map? Read the journal instead.',
		openMap: 'Map',
		closeMap: 'Close map'
	},
	entry: {
		previous: 'Older',
		next: 'Newer',
		translationNote: 'Not yet translated - showing the original.'
	},
	archive: {
		title: 'Archive',
		filterAll: 'All',
		filterLife: 'Life',
		filterSchool: 'School',
		filterTrip: 'Trip'
	},
	journal: {
		title: 'Journal',
		older: 'Older',
		newer: 'Newer'
	},
	common: {
		noEntries: 'Nothing here yet.'
	},
	languageToggle: {
		da: 'Dansk',
		en: 'English'
	},
	visibility: {
		public: 'Public',
		family: 'Followers only',
		private: 'Only me'
	},
	follow: {
		gatedTitle: 'Followers only',
		gatedBody: 'This one is for followers. Enter your email to ask to follow, or log in if you already do.',
		emailLabel: 'Email',
		emailPlaceholder: 'you@example.com',
		requestButton: 'Send me a code',
		requestSent: 'Check your email for a 6-digit code.',
		codeLabel: 'Code',
		codePlaceholder: '123456',
		verifyButton: 'Log in',
		verifyError: "That code didn't work - check it and try again.",
		pending: "You're logged in. Reload the page to see if you've been approved yet.",
		reload: 'Reload',
		genericError: 'Something went wrong - try again in a moment.'
	}
};
