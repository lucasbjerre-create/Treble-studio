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
	// The prefix before a photo's tagged names, e.g. "With Anna, Erik" - the
	// names themselves are proper nouns, not translated.
	media: {
		with: string;
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
	slideshow: {
		navLink: string;
		play: string;
		pause: string;
		previous: string;
		next: string;
		close: string;
		speedLabel: string;
		speedSlow: string;
		speedNormal: string;
		speedFast: string;
		collageLabel: string;
		collageAuto: string;
		collageOne: string;
		collageTwo: string;
		collageThree: string;
		collageFour: string;
		transitionLabel: string;
		transitionFade: string;
		transitionSlide: string;
		transitionZoom: string;
		shuffle: string;
		fullscreenEnter: string;
		fullscreenExit: string;
		loading: string;
		empty: string;
		backToProfile: string;
		error: string;
		retry: string;
		/** "{current}" and "{total}" are replaced in code - not real tokens for a translation tool, but this project has none yet. */
		progress: string;
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
	media: {
		with: 'With'
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
	},
	slideshow: {
		navLink: 'Slideshow',
		play: 'Play',
		pause: 'Pause',
		previous: 'Previous',
		next: 'Next',
		close: 'Close',
		speedLabel: 'Speed',
		speedSlow: 'Slow',
		speedNormal: 'Normal',
		speedFast: 'Fast',
		collageLabel: 'Photos per slide',
		collageAuto: 'Auto',
		collageOne: '1',
		collageTwo: '2',
		collageThree: '3',
		collageFour: '4',
		transitionLabel: 'Transition',
		transitionFade: 'Fade',
		transitionSlide: 'Slide',
		transitionZoom: 'Zoom',
		shuffle: 'Shuffle',
		fullscreenEnter: 'Fullscreen',
		fullscreenExit: 'Exit fullscreen',
		loading: 'Loading photos…',
		empty: 'No photos to show yet.',
		backToProfile: 'Back to profile',
		error: "Couldn't load more photos.",
		retry: 'Try again',
		progress: '{current} of {total}'
	}
};
