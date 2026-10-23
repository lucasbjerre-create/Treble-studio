export interface Dictionary {
	siteTitle: string;
	nav: {
		journal: string;
		archive: string;
	};
	home: {
		latestEntry: string;
		currentChapter: string;
		exploreMap: string;
		comingSoon: string;
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
}

export const en: Dictionary = {
	siteTitle: 'Exchange year',
	nav: {
		journal: 'Journal',
		archive: 'Archive'
	},
	home: {
		latestEntry: 'Latest entry',
		currentChapter: 'Current chapter',
		exploreMap: 'Explore map',
		comingSoon: '(coming soon)'
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
	}
};
