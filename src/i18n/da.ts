import type { Dictionary } from './en';

export const da: Dictionary = {
	siteTitle: 'Udvekslingsår',
	nav: {
		journal: 'Journal',
		archive: 'Arkiv',
		explore: 'Udforsk'
	},
	home: {
		latestEntry: 'Seneste indlæg',
		currentChapter: 'Nuværende kapitel',
		exploreMap: 'Udforsk kortet',
		chooseYourTrebler: 'Vælg din TREBLEr'
	},
	explore: {
		title: 'Udforsk ruten',
		nonMapAlternative: 'Foretrækker du intet kort? Læs journalen i stedet.',
		openMap: 'Kort',
		closeMap: 'Luk kortet',
		// Provisional wording - flag for Lucas to adjust in /studio if it doesn't sound right.
		crossingMarker: 'Scholarer der krydsede veje her'
	},
	entry: {
		previous: 'Ældre',
		next: 'Nyere',
		translationNote: 'Endnu ikke oversat - viser originalen.'
	},
	archive: {
		title: 'Arkiv',
		filterAll: 'Alle',
		filterLife: 'Liv',
		filterSchool: 'Skole',
		filterTrip: 'Rejse'
	},
	journal: {
		title: 'Journal',
		older: 'Ældre',
		newer: 'Nyere'
	},
	common: {
		noEntries: 'Ikke noget her endnu.'
	},
	// Provisional wording - flag for Lucas to adjust if it doesn't sound right.
	notFound: {
		title: 'Siden blev ikke fundet',
		body: 'Der er ingen side på denne adresse.',
		home: 'Gå til forsiden',
		journal: 'Læs journalen'
	},
	languageToggle: {
		da: 'Dansk',
		en: 'English'
	},
	visibility: {
		public: 'Offentlig',
		family: 'Kun følgere',
		private: 'Kun mig'
	},
	media: {
		with: 'Med'
	},
	follow: {
		gatedTitle: 'Kun for følgere',
		gatedBody: 'Dette er kun for følgere. Indtast din email for at bede om at følge, eller log ind hvis du allerede gør.',
		emailLabel: 'Email',
		emailPlaceholder: 'dig@eksempel.dk',
		requestButton: 'Send mig en kode',
		requestSent: 'Tjek din email for en 6-cifret kode.',
		codeLabel: 'Kode',
		codePlaceholder: '123456',
		verifyButton: 'Log ind',
		verifyError: 'Koden virkede ikke - tjek den og prøv igen.',
		pending: 'Du er logget ind. Genindlæs siden for at se om du er blevet godkendt endnu.',
		reload: 'Genindlæs',
		genericError: 'Noget gik galt - prøv igen om lidt.'
	},
	slideshow: {
		navLink: 'Diasshow',
		play: 'Afspil',
		pause: 'Pause',
		previous: 'Forrige',
		next: 'Næste',
		close: 'Luk',
		speedLabel: 'Hastighed',
		speedSlow: 'Langsom',
		speedNormal: 'Normal',
		speedFast: 'Hurtig',
		collageLabel: 'Fotos per billede',
		collageAuto: 'Auto',
		collageOne: '1',
		collageTwo: '2',
		collageThree: '3',
		collageFour: '4',
		transitionLabel: 'Overgang',
		transitionFade: 'Udtoning',
		transitionSlide: 'Glid',
		transitionZoom: 'Zoom',
		shuffle: 'Bland',
		fullscreenEnter: 'Fuld skærm',
		fullscreenExit: 'Afslut fuld skærm',
		loading: 'Indlæser fotos…',
		empty: 'Ingen fotos at vise endnu.',
		backToProfile: 'Tilbage til profilen',
		error: 'Kunne ikke indlæse flere fotos.',
		retry: 'Prøv igen',
		progress: '{current} af {total}'
	}
};
