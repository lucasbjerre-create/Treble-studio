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
		exploreMap: 'Explore map'
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
	}
};
