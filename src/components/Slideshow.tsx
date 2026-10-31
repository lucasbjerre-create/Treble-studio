import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	availableCollageSizes,
	clampCollageSizeForViewport,
	DEFAULT_SLIDESHOW_PREFERENCES,
	groupIntoCompositions,
	holdDurationMs,
	nextPosition,
	orderedCompositionIndices,
	previousPosition,
	transitionDurationMs,
	validateSlideshowPreferences,
	viewportCategoryFromWidth,
	type CollageSize,
	type Speed,
	type SlideshowPhoto,
	type TransitionStyle
} from '../lib/slideshow';
import { publicMediaUrl } from '../lib/mediaUrl';
import './Slideshow.css';

const PREFERENCES_KEY = 'treble:slideshow-prefs';
const PAGE_LIMIT = 24;
const PREFETCH_COMPOSITIONS_REMAINING = 2;
const ALL_BROKEN_SKIP_DELAY_MS = 1500;

function loadStoredPreferences() {
	try {
		const raw = window.localStorage.getItem(PREFERENCES_KEY);
		return validateSlideshowPreferences(raw ? JSON.parse(raw) : null);
	} catch {
		// Private browsing, cleared site data, corrupted JSON - the defaults
		// are always a safe, usable fallback.
		return DEFAULT_SLIDESHOW_PREFERENCES;
	}
}

function saveStoredPreferences(speed: Speed, collageSize: CollageSize, transitionStyle: TransitionStyle) {
	try {
		window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ speed, collageSize, transitionStyle }));
	} catch {
		// Not persisting a preference is harmless - never surface this to the viewer.
	}
}

export interface SlideshowStrings {
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
	backToProfile: string;
	error: string;
	retry: string;
	/** "{current}"/"{total}" are replaced with numbers - see formatProgress below. */
	progress: string;
}

interface Props {
	personSlug: string;
	profileHref: string;
	initialPhotos: SlideshowPhoto[];
	initialHasMore: boolean;
	strings: SlideshowStrings;
}

function formatProgress(template: string, current: number, total: number): string {
	return template.replace('{current}', String(current)).replace('{total}', String(total));
}

function imageUrl(photo: SlideshowPhoto, preferLarge: boolean): string | null {
	const key = (preferLarge ? photo.keyLarge ?? photo.keyDisplay : photo.keyDisplay ?? photo.keyLarge) ?? null;
	return key ? publicMediaUrl(key) : null;
}

export default function Slideshow({ personSlug, profileHref, initialPhotos, initialHasMore, strings }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);

	const [photos, setPhotos] = useState(initialPhotos);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const [loadingMore, setLoadingMore] = useState(false);
	const [loadError, setLoadError] = useState(false);

	const stored = useMemo(loadStoredPreferences, []);
	const [speed, setSpeed] = useState<Speed>(stored.speed);
	const [requestedCollageSize, setRequestedCollageSize] = useState<CollageSize>(stored.collageSize);
	const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>(stored.transitionStyle);
	const [shuffle, setShuffle] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [position, setPosition] = useState(0);
	const [brokenIds, setBrokenIds] = useState<ReadonlySet<number>>(new Set());
	const [reducedMotion, setReducedMotion] = useState(false);
	const [viewport, setViewport] = useState<'phone' | 'tablet' | 'desktop'>('desktop');
	const sessionSeed = useRef(Date.now());

	// prefers-reduced-motion, live - same convention as TimelineExplorer.tsx.
	useEffect(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		setReducedMotion(query.matches);
		const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	}, []);

	useEffect(() => {
		function onResize() {
			setViewport(viewportCategoryFromWidth(window.innerWidth));
		}
		onResize();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const collageSize = clampCollageSizeForViewport(requestedCollageSize, viewport);

	const compositions = useMemo(() => groupIntoCompositions(photos, collageSize, viewport), [photos, collageSize, viewport]);
	const order = useMemo(
		() => orderedCompositionIndices(compositions.length, shuffle, sessionSeed.current),
		[compositions.length, shuffle]
	);

	// Collage size / shuffle changes land the viewer back at the start rather
	// than an index that now means something else in the regrouped sequence.
	useEffect(() => {
		setPosition(0);
	}, [collageSize, shuffle]);

	const safePosition = Math.min(position, Math.max(order.length - 1, 0));
	const currentIndex = order[safePosition] ?? 0;
	const current = compositions[currentIndex];

	const pause = useCallback(() => setIsPlaying(false), []);

	const goNext = useCallback(() => {
		pause();
		setPosition((p) => nextPosition(p, order.length));
	}, [order.length, pause]);

	const goPrevious = useCallback(() => {
		pause();
		setPosition((p) => previousPosition(p, order.length));
	}, [order.length, pause]);

	// Fetch more authorized photos as the viewer approaches the end of what's
	// loaded - never reveals a total count, just pages through hasMore.
	useEffect(() => {
		if (!hasMore || loadingMore) return;
		if (order.length - safePosition > PREFETCH_COMPOSITIONS_REMAINING) return;

		const controller = new AbortController();
		setLoadingMore(true);
		setLoadError(false);
		fetch(`/api/slideshow/${encodeURIComponent(personSlug)}?offset=${photos.length}&limit=${PAGE_LIMIT}`, {
			signal: controller.signal
		})
			.then((res) => {
				if (!res.ok) throw new Error('bad response');
				return res.json() as Promise<{ items: SlideshowPhoto[]; hasMore: boolean }>;
			})
			.then((page) => {
				setPhotos((existing) => [...existing, ...page.items]);
				setHasMore(page.hasMore);
			})
			.catch((err) => {
				if (err?.name !== 'AbortError') setLoadError(true);
			})
			.finally(() => setLoadingMore(false));

		return () => controller.abort();
		// personSlug changing would mean a different slideshow entirely - this
		// component is remounted by its Astro page per person, so that's not a
		// real dependency here, only photos.length/hasMore/safePosition drive refetches.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hasMore, loadingMore, order.length, safePosition, photos.length, personSlug]);

	// Preload the adjacent compositions' images only - never the whole set.
	useEffect(() => {
		for (const index of [currentIndex, order[nextPosition(safePosition, order.length)], order[previousPosition(safePosition, order.length)]]) {
			const composition = compositions[index ?? -1];
			if (!composition) continue;
			for (const photo of composition.photos) {
				const url = imageUrl(photo, true);
				if (url) {
					const img = new Image();
					img.src = url;
				}
			}
		}
	}, [compositions, currentIndex, order, safePosition]);

	// Autoplay, only once explicitly started.
	useEffect(() => {
		if (!isPlaying || order.length <= 1) return;
		const timer = window.setTimeout(() => {
			setPosition((p) => nextPosition(p, order.length));
		}, holdDurationMs(speed));
		return () => window.clearTimeout(timer);
	}, [isPlaying, speed, position, order.length]);

	// Tab hidden -> pause, and never auto-resume when it's shown again.
	useEffect(() => {
		function onVisibilityChange() {
			if (document.hidden) pause();
		}
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => document.removeEventListener('visibilitychange', onVisibilityChange);
	}, [pause]);

	useEffect(() => {
		function onFullscreenChange() {
			setIsFullscreen(document.fullscreenElement === containerRef.current);
		}
		document.addEventListener('fullscreenchange', onFullscreenChange);
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
	}, []);

	// If every photo in the current composition failed to load, move on
	// rather than leaving the viewer looking at an empty slide forever.
	useEffect(() => {
		if (!current) return;
		const allBroken = current.photos.length > 0 && current.photos.every((p) => brokenIds.has(p.id));
		if (!allBroken) return;
		const timer = window.setTimeout(() => setPosition((p) => nextPosition(p, order.length)), ALL_BROKEN_SKIP_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [current, brokenIds, order.length]);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				if (document.fullscreenElement) return; // let the browser exit fullscreen; don't also navigate away
				window.location.href = profileHref;
				return;
			}
			const target = e.target;
			if (target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				goNext();
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				goPrevious();
			} else if (e.key === ' ') {
				e.preventDefault();
				setIsPlaying((p) => !p);
			} else if (e.key === 'f' || e.key === 'F') {
				toggleFullscreen();
			}
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [goNext, goPrevious, profileHref]);

	function toggleFullscreen() {
		if (!document.fullscreenEnabled || !containerRef.current) return;
		pause();
		if (document.fullscreenElement) {
			void document.exitFullscreen();
		} else {
			void containerRef.current.requestFullscreen();
		}
	}

	function changeSpeed(next: Speed) {
		pause();
		setSpeed(next);
		saveStoredPreferences(next, requestedCollageSize, transitionStyle);
	}

	function changeCollageSize(next: CollageSize) {
		pause();
		setRequestedCollageSize(next);
		saveStoredPreferences(speed, next, transitionStyle);
	}

	function changeTransitionStyle(next: TransitionStyle) {
		pause();
		setTransitionStyle(next);
		saveStoredPreferences(speed, requestedCollageSize, next);
	}

	function toggleShuffle() {
		pause();
		setShuffle((s) => !s);
	}

	function markBroken(id: number) {
		setBrokenIds((existing) => new Set(existing).add(id));
	}

	const totalCompositions = order.length;
	const progressText = formatProgress(strings.progress, totalCompositions === 0 ? 0 : safePosition + 1, totalCompositions);
	const transitionMs = transitionDurationMs(reducedMotion);
	const collageOptions = availableCollageSizes(viewport);
	const collageLabelFor: Record<string, string> = {
		'1': strings.collageOne,
		'2': strings.collageTwo,
		'3': strings.collageThree,
		'4': strings.collageFour,
		auto: strings.collageAuto
	};

	return (
		<div className="slideshow" ref={containerRef} data-fullscreen={isFullscreen || undefined}>
			<div className="slideshow-topbar">
				<div className="slideshow-progress" aria-live="polite">
					{progressText}
				</div>
				<div className="slideshow-topbar-actions">
					{document.fullscreenEnabled && (
						<button
							type="button"
							className="slideshow-icon-button"
							onClick={toggleFullscreen}
							aria-pressed={isFullscreen}
							aria-label={isFullscreen ? strings.fullscreenExit : strings.fullscreenEnter}
							title={isFullscreen ? strings.fullscreenExit : strings.fullscreenEnter}
						>
							{isFullscreen ? '⤡' : '⤢'}
						</button>
					)}
					<a
						className="slideshow-icon-button slideshow-icon-button--close"
						href={profileHref}
						aria-label={strings.close}
						title={strings.close}
					>
						&times;
					</a>
				</div>
			</div>

			<div
				className="slideshow-stage"
				data-transition={transitionStyle}
				style={{ '--slideshow-transition': `${transitionMs}ms` } as React.CSSProperties}
			>
				{current &&
					current.photos.map((photo) => {
						const broken = brokenIds.has(photo.id);
						const url = imageUrl(photo, true);
						return (
							<figure key={photo.id} className={`slideshow-slot slideshow-slot--${current.layout}`}>
								{/* No fixed aspect-ratio on the slot itself: it fills its grid
								    cell and object-fit: contain (Slideshow.css) preserves the
								    photo's real aspect ratio without cropping or stretching. */}
								{broken || !url ? (
									<div className="slideshow-slot-error" aria-hidden="true" />
								) : (
									<img
										src={url}
										alt={photo.altText ?? ''}
										onError={() => markBroken(photo.id)}
										draggable={false}
									/>
								)}
								{photo.caption && <figcaption>{photo.caption}</figcaption>}
							</figure>
						);
					})}
			</div>

			{loadError && (
				<div className="slideshow-banner" role="alert">
					<span>{strings.error}</span>
					<button type="button" onClick={() => setLoadError(false)}>
						{strings.retry}
					</button>
				</div>
			)}

			<div className="slideshow-panel">
				<div className="slideshow-panel-row slideshow-panel-row--nav">
					<button type="button" className="slideshow-nav-button" onClick={goPrevious} aria-label={strings.previous} disabled={totalCompositions <= 1}>
						&larr;
					</button>
					<button
						type="button"
						className="slideshow-play-button"
						onClick={() => setIsPlaying((p) => !p)}
						aria-pressed={isPlaying}
						aria-label={isPlaying ? strings.pause : strings.play}
						disabled={totalCompositions <= 1}
					>
						{isPlaying ? '❚❚' : '►'}
						<span className="slideshow-play-button-label">{isPlaying ? strings.pause : strings.play}</span>
					</button>
					<button type="button" className="slideshow-nav-button" onClick={goNext} aria-label={strings.next} disabled={totalCompositions <= 1}>
						&rarr;
					</button>
				</div>

				<div className="slideshow-panel-divider" aria-hidden="true" />

				<div className="slideshow-panel-row slideshow-panel-row--settings">
					<label className="slideshow-field">
						<span>{strings.speedLabel}</span>
						<select value={speed} onChange={(e) => changeSpeed(e.target.value as Speed)}>
							<option value="slow">{strings.speedSlow}</option>
							<option value="normal">{strings.speedNormal}</option>
							<option value="fast">{strings.speedFast}</option>
						</select>
					</label>

					<label className="slideshow-field">
						<span>{strings.collageLabel}</span>
						<select value={String(requestedCollageSize)} onChange={(e) => changeCollageSize((isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) as CollageSize)}>
							{collageOptions.map((option) => (
								<option key={String(option)} value={String(option)}>
									{collageLabelFor[String(option)]}
								</option>
							))}
						</select>
					</label>

					<label className="slideshow-field">
						<span>{strings.transitionLabel}</span>
						<select value={transitionStyle} onChange={(e) => changeTransitionStyle(e.target.value as TransitionStyle)}>
							<option value="fade">{strings.transitionFade}</option>
							<option value="slide">{strings.transitionSlide}</option>
							<option value="zoom">{strings.transitionZoom}</option>
						</select>
					</label>

					<button type="button" className="slideshow-toggle-button" onClick={toggleShuffle} aria-pressed={shuffle}>
						{strings.shuffle}
					</button>
				</div>
			</div>
		</div>
	);
}
