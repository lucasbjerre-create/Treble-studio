import { greatCircle } from '@turf/great-circle';
import { Map as MapLibreMap, Marker, Popup, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// The `?worker&url` suffix matters: plain `?url` omits a sibling chunk the
// worker needs, which works in dev but 404s in a production build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'react';
import './TimelineExplorer.css';
import { CAMERA_CINEMATIC_MS, CAMERA_MOVE_MS, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_STYLE_URL } from '../config/map';
import { CAMPUSES } from '../config/campuses';
import { initialsFor } from '../lib/initials';
import {
	adjacentChapterEntryDate,
	adjacentEntryDate,
	computeTimelineState,
	type TimelineEntry,
	type TimelineLeg
} from '../lib/timeline';

let workerUrlSet = false;

export interface ExplorerEntry extends TimelineEntry {
	slug: string;
	title: string;
	/** Already-resolved, audience-checked thumbnail URL, or null for a text-only entry - see explore.astro. */
	thumb: string | null;
	/** The thumb's real pixel size, so the map popup can reserve its original aspect ratio instead of cropping to a fixed one. Null when thumb is null or the media row predates width/height capture. */
	thumbWidth: number | null;
	thumbHeight: number | null;
}

export interface ExplorerLeg extends TimelineLeg {
	mode: string;
}

export interface ExplorerPlace {
	id: number;
	label: string;
	latPublic: number | null;
	lonPublic: number | null;
}

/** Keyed by personId. Drives the scholar-seat colour/dash/initials on markers and trails (map-theme.json). */
export interface ExplorerPerson {
	displayName: string;
	seat: number | null;
}

interface Props {
	lang: 'da' | 'en';
	personSlug: string;
	entries: ExplorerEntry[];
	legs: ExplorerLeg[];
	places: ExplorerPlace[];
	people: Record<number, ExplorerPerson>;
	labels: { previous: string; next: string; openMap: string; closeMap: string };
}

function placeCoords(places: ExplorerPlace[], placeId: number | null): [number, number] | undefined {
	const place = places.find((p) => p.id === placeId);
	if (!place || place.latPublic === null || place.lonPublic === null) return undefined;
	return [place.lonPublic, place.latPublic];
}

function readDateFromUrl(): string | undefined {
	return new URLSearchParams(window.location.search).get('at') ?? undefined;
}

function writeDateToUrl(date: string) {
	const url = new URL(window.location.href);
	url.searchParams.set('at', date);
	window.history.replaceState(null, '', url);
}

function cssVar(name: string, fallback: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

interface SeatStyle {
	color: string;
	textColor: string;
	dashed: boolean;
}

/**
 * Reads the already-themed `--scholar*` custom properties tokens.css sets
 * under `[data-seat="N"]`, rather than re-encoding the seat->hue table from
 * map-theme.json a second time here. Picks up light/dark automatically,
 * same as the `cssVar` accent/muted reads below.
 */
function readSeatStyle(seat: number, cache: Map<number, SeatStyle>): SeatStyle {
	const cached = cache.get(seat);
	if (cached) return cached;

	const probe = document.createElement('span');
	probe.setAttribute('data-seat', String(seat));
	probe.style.display = 'none';
	document.body.appendChild(probe);
	const computed = getComputedStyle(probe);
	const result: SeatStyle = {
		color: computed.getPropertyValue('--scholar').trim() || cssVar('--color-link', '#4967aa'),
		textColor: computed.getPropertyValue('--scholar-text').trim() || '#ffffff',
		dashed: computed.getPropertyValue('--scholar-dash').trim() !== 'none'
	};
	document.body.removeChild(probe);
	cache.set(seat, result);
	return result;
}

/**
 * Retints the OpenFreeMap (OpenMapTiles-schema) base style with
 * docs/brand/map-theme.json's colours, read live from the `--map-*` tokens
 * so light/dark/system-theme-change all just work. Keeps the provider's own
 * layer structure/filters - only paint colour is overridden, so this stays
 * swappable the way src/config/map.ts's own comment promises.
 */
function applyMapTheme(map: MapLibreMap) {
	const theme = {
		land: cssVar('--map-land', '#edeae3'),
		water: cssVar('--map-water', '#c9d5dc'),
		park: cssVar('--map-park', '#e1e3d6'),
		building: cssVar('--map-building', '#e4e0d7'),
		road: cssVar('--map-road', '#ffffff'),
		roadMajor: cssVar('--map-road-major', '#fbfaf7'),
		boundary: cssVar('--map-boundary', '#c4bbac'),
		label: cssVar('--map-label', '#6e6e6b'),
		labelHalo: cssVar('--map-label-halo', '#edeae3'),
		dimmed: cssVar('--map-dimmed', '#a9a69f')
	};

	for (const layer of map.getStyle().layers ?? []) {
		const id = layer.id;
		try {
			if (layer.type === 'background') {
				map.setPaintProperty(id, 'background-color', theme.land);
			} else if (layer.type === 'symbol') {
				map.setPaintProperty(id, 'text-color', theme.label);
				map.setPaintProperty(id, 'text-halo-color', theme.labelHalo);
			} else if (id === 'water' || id === 'waterway' || id.startsWith('waterway')) {
				map.setPaintProperty(id, layer.type === 'fill' ? 'fill-color' : 'line-color', theme.water);
			} else if (id === 'park' || id === 'landcover_wood') {
				map.setPaintProperty(id, 'fill-color', theme.park);
			} else if (id.startsWith('landcover') || id.startsWith('landuse')) {
				map.setPaintProperty(id, 'fill-color', theme.land);
			} else if (id === 'building') {
				map.setPaintProperty(id, 'fill-color', theme.building);
			} else if (id.startsWith('boundary')) {
				map.setPaintProperty(id, 'line-color', theme.boundary);
			} else if (id.startsWith('railway')) {
				map.setPaintProperty(id, 'line-color', theme.dimmed);
			} else if (
				id.startsWith('highway_motorway') ||
				id.startsWith('highway_major') ||
				id.startsWith('tunnel_motorway')
			) {
				map.setPaintProperty(id, 'line-color', theme.roadMajor);
			} else if (
				id.startsWith('highway_minor') ||
				id.startsWith('highway_path') ||
				id.startsWith('road_') ||
				id.startsWith('aeroway')
			) {
				map.setPaintProperty(id, 'line-color', theme.road);
			}
		} catch {
			// Not every layer has the paint property being set (e.g. a shield
			// symbol layer with no visible text) - setPaintProperty throws for an
			// unknown property name on that layer type, which is fine to skip.
		}
	}
}

export default function TimelineExplorer({ lang, personSlug, entries, legs, places, people, labels }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const seatStyleCache = useRef(new Map<number, SeatStyle>());
	const campusMarkersRef = useRef<Marker[]>([]);
	const entryPopupRef = useRef<Popup | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);

	// Stable tie-break (same comparator shape as src/lib/timeline.ts's
	// sortByOccurredAt) - the previous version returned 1 for equal
	// occurredAt instead of 0, which is not a valid comparator and could
	// disagree with computeTimelineState's own ordering for same-instant
	// entries, pointing activeIndex at the wrong slider position.
	const sortedEntries = [...entries].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
	const initialDate = readDateFromUrl() ?? sortedEntries.at(-1)?.occurredAt ?? '';
	const [date, setDate] = useState(initialDate);

	const state = computeTimelineState(entries, legs, date);

	// No suspension flag guarding the scroll-triggered IntersectionObserver
	// against this function's own scrollIntoView calls: an earlier version
	// tried that and it ended up swallowing a genuine scroll that followed
	// shortly after a marker click (caught in e2e testing). The observer
	// settles on whatever is actually in view once a scroll animation ends,
	// which is correct either way - simpler, and correctness doesn't depend
	// on guessing when "the" scroll finished.
	function navigateTo(nextDate: string | undefined, options: { scrollJournal?: boolean } = {}) {
		if (!nextDate) return;
		setDate(nextDate);
		// Scrolling defaults to off: the slider/keyboard/prev-next buttons are
		// map controls, and scrollIntoView-ing the matching journal card could
		// carry the map itself out of the viewport (the map sits above the
		// journal list in the DOM) - which then makes a *second* marker click
		// impossible without the reader first scrolling back up by hand (caught
		// in e2e testing: the slider-then-click test's click landed at a
		// negative, off-screen y coordinate once this scroll had happened).
		// A marker click is the one interaction that should still jump to its
		// journal entry, since that's the point of clicking it - it opts in
		// explicitly below.
		if (options.scrollJournal === true) {
			const entry = entries.find((e) => e.occurredAt === nextDate);
			document.getElementById(`entry-${entry?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	// Map setup - once, client-only (never imported in server code, per
	// CLAUDE.md). Markers, legs and camera all re-sync below on `date` change.
	useEffect(() => {
		if (!containerRef.current) return;

		if (!workerUrlSet) {
			setWorkerUrl(workerUrl);
			workerUrlSet = true;
		}

		const map = new MapLibreMap({
			container: containerRef.current,
			style: MAP_STYLE_URL,
			center: placeCoords(places, sortedEntries.at(-1)?.placeId ?? null) ?? MAP_DEFAULT_CENTER,
			zoom: MAP_DEFAULT_ZOOM
			// cooperativeGestures (requiring ctrl+scroll to zoom, two fingers to
			// pan on touch) used to be set here to keep a one-finger swipe
			// scrolling the page instead of the map. Removed: this is a
			// dedicated "Explore the route" page, not a map embedded mid-article,
			// so a reader arriving here expects the map to respond directly to
			// scroll/drag - confirmed live that with it on, a plain scroll-wheel
			// produced zero zoom change at all, which is what read as "won't
			// let you roam the map." If a map ever gets embedded somewhere it
			// shares scroll with surrounding content, reconsider it there.
		});
		mapRef.current = map;
		// e2e-test-only accessor: a WebGL canvas has no inspectable DOM content,
		// so the explore.spec.ts test uses this to compute a marker's real pixel
		// position via map.project(), and to wait for camera moves to finish.
		(window as unknown as { __explorerMap?: MapLibreMap }).__explorerMap = map;

		map.on('load', () => {
			map.addSource('markers', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] },
				cluster: true,
				clusterMaxZoom: 8,
				clusterRadius: 40
			});
			map.addSource('legs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

			applyMapTheme(map);
			const dimmed = cssVar('--map-dimmed', '#a9a69f');
			const land = cssVar('--map-land', '#edeae3');
			const casing = cssVar('--map-trail-casing', '#f4f2ed');

			// Casing first, so the coloured seat lines render on top of it.
			map.addLayer({
				id: 'legs-casing',
				type: 'line',
				source: 'legs',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': casing,
					'line-width': ['interpolate', ['linear'], ['zoom'], 2, 3.5, 8, 4.5, 14, 5.5],
					'line-opacity': ['case', ['==', ['get', 'status'], 'current'], 1, 0.6]
				}
			});
			map.addLayer({
				id: 'legs-line-solid',
				type: 'line',
				source: 'legs',
				filter: ['!', ['get', 'dashed']],
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': ['get', 'color'],
					'line-width': [
						'interpolate',
						['linear'],
						['zoom'],
						2,
						['case', ['get', 'isFlight'], 1, 1.5],
						8,
						['case', ['get', 'isFlight'], 1.5, 2.5],
						14,
						['case', ['get', 'isFlight'], 1.5, 3.5]
					],
					'line-opacity': ['case', ['==', ['get', 'status'], 'current'], 1, 0.6]
				}
			});
			map.addLayer({
				id: 'legs-line-dashed',
				type: 'line',
				source: 'legs',
				filter: ['get', 'dashed'],
				layout: { 'line-cap': 'butt', 'line-join': 'round' },
				paint: {
					'line-color': ['get', 'color'],
					'line-width': [
						'interpolate',
						['linear'],
						['zoom'],
						2,
						['case', ['get', 'isFlight'], 1, 1.5],
						8,
						['case', ['get', 'isFlight'], 1.5, 2.5],
						14,
						['case', ['get', 'isFlight'], 1.5, 3.5]
					],
					'line-opacity': ['case', ['==', ['get', 'status'], 'current'], 1, 0.6],
					'line-dasharray': [2, 1.4]
				}
			});

			map.addLayer({
				id: 'clusters',
				type: 'circle',
				source: 'markers',
				filter: ['has', 'point_count'],
				paint: { 'circle-color': dimmed, 'circle-radius': 14, 'circle-opacity': 0.9 }
			});
			map.addLayer({
				id: 'cluster-count',
				type: 'symbol',
				source: 'markers',
				filter: ['has', 'point_count'],
				layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
				paint: { 'text-color': land }
			});
			// Scholar marker: coloured circle (map-theme.json markers.scholar,
			// size 28 -> radius 14) with a land-coloured ring, initials on top.
			map.addLayer({
				id: 'marker-point',
				type: 'circle',
				source: 'markers',
				filter: ['!', ['has', 'point_count']],
				paint: {
					'circle-color': ['get', 'color'],
					'circle-radius': ['case', ['get', 'isActive'], 14, 11],
					'circle-stroke-width': 2,
					'circle-stroke-color': land
				}
			});
			map.addLayer({
				id: 'marker-initials',
				type: 'symbol',
				source: 'markers',
				filter: ['!', ['has', 'point_count']],
				layout: {
					'text-field': ['get', 'initials'],
					'text-size': 11,
					'text-font': ['Noto Sans Bold'],
					'text-allow-overlap': true,
					'text-ignore-placement': true
				},
				paint: { 'text-color': ['get', 'textColor'] }
			});

			map.on('click', 'marker-point', (e) => {
				const entryId = e.features?.[0]?.properties?.entryId;
				const entry = entries.find((en) => en.id === entryId);
				if (entry) navigateTo(entry.occurredAt, { scrollJournal: true });
			});
			map.on('mouseenter', 'marker-point', () => {
				map.getCanvas().style.cursor = 'pointer';
			});
			map.on('mouseleave', 'marker-point', () => {
				map.getCanvas().style.cursor = '';
			});

			// Campus markers (map-theme.json campuses + markers.campus): plain
			// HTML markers, not a map layer - there are only three, they never
			// move, and a square tile with a glyph is far simpler as DOM+CSS
			// than rasterizing the kit's SVGs into a sprite for an icon-image.
			for (const campus of CAMPUSES) {
				const el = document.createElement('div');
				el.className = 'campus-marker';
				el.title = campus.nameEn;
				// Mask rather than <img src>: a CSS mask reduces the glyph (SVG or
				// PNG) to its alpha shape and fills it with the marker's own
				// color, so every campus glyph reads as one flat tint instead of
				// carrying its source file's own colors.
				const glyph = document.createElement('span');
				glyph.className = 'campus-marker-glyph';
				glyph.style.maskImage = `url(${campus.glyph})`;
				glyph.style.setProperty('-webkit-mask-image', `url(${campus.glyph})`);
				el.appendChild(glyph);
				const marker = new Marker({ element: el, anchor: 'center' }).setLngLat([campus.lon, campus.lat]).addTo(map);
				campusMarkersRef.current.push(marker);
			}

			// Shows the active entry's photo and title, following the marker as
			// the slider moves - not a per-photo marker (spec: "one marker per
			// entry, never per photo"), just a small preview of the day you're
			// looking at right now. No close button: it isn't a dismissable
			// dialog, it's a label that always reflects the current date.
			entryPopupRef.current = new Popup({
				closeButton: false,
				closeOnClick: false,
				offset: 18,
				className: 'entry-popup',
				maxWidth: '220px'
			});

			syncMapToState();
		});

		// Stop automatic camera movement as soon as the reader touches the map (CLAUDE.md).
		map.on('dragstart', () => {
			map.stop();
		});

		const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const onThemeChange = () => {
			seatStyleCache.current.clear();
			if (map.isStyleLoaded()) {
				applyMapTheme(map);
				syncMapToState();
			}
		};
		darkMediaQuery.addEventListener('change', onThemeChange);

		return () => {
			darkMediaQuery.removeEventListener('change', onThemeChange);
			for (const marker of campusMarkersRef.current) marker.remove();
			campusMarkersRef.current = [];
			entryPopupRef.current?.remove();
			entryPopupRef.current = null;
			map.remove();
			mapRef.current = null;
			delete (window as unknown as { __explorerMap?: MapLibreMap }).__explorerMap;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function markerStyleForPerson(personId: number): { color: string; textColor: string } {
		const seat = people[personId]?.seat;
		if (seat === null || seat === undefined) {
			return { color: cssVar('--map-dimmed', '#a9a69f'), textColor: '#ffffff' };
		}
		const style = readSeatStyle(seat, seatStyleCache.current);
		return { color: style.color, textColor: style.textColor };
	}

	function syncMapToState() {
		const map = mapRef.current;
		// Not map.isStyleLoaded(): that call is itself what the 'load' handler
		// below is waiting on, and adding the markers/legs sources in that same
		// handler (just before calling this) can leave isStyleLoaded() false
		// for a tick even though those sources are already there and settable -
		// which silently dropped every marker/leg until the next unrelated
		// state change happened to call this again (caught by comparing what
		// the map actually rendered against computeTimelineState's own output
		// for the same input, not by guessing from the symptom). Checking for
		// the source directly is what this guard actually needs: skip only the
		// call(s) that land before 'load' has added it at all.
		if (!map || !map.getSource('markers')) return;

		const markerFeatures = state.visibleMarkers
			.map((marker) => {
				const coords = placeCoords(places, marker.placeId);
				if (!coords) return undefined;
				const { color, textColor } = markerStyleForPerson(marker.personId);
				const initials = initialsFor(people[marker.personId]?.displayName ?? '?');
				return {
					type: 'Feature' as const,
					geometry: { type: 'Point' as const, coordinates: coords },
					properties: { entryId: marker.entryId, isActive: marker.isActive, color, textColor, initials }
				};
			})
			.filter((f): f is NonNullable<typeof f> => f !== undefined);
		(map.getSource('markers') as GeoJSONSource | undefined)?.setData({
			type: 'FeatureCollection',
			features: markerFeatures
		});

		const legFeatures = state.routeProgress
			.filter((progress) => progress.status !== 'future')
			.map((progress) => {
				const leg = legs.find((l) => l.id === progress.legId);
				if (!leg) return undefined;
				const from = placeCoords(places, leg.fromPlaceId);
				const to = placeCoords(places, leg.toPlaceId);
				if (!from || !to) return undefined;
				const isFlight = leg.mode === 'flight';
				const geometry = isFlight
					? greatCircle(from, to).geometry
					: { type: 'LineString' as const, coordinates: [from, to] };
				const seat = people[leg.personId]?.seat;
				const seatStyle = seat !== null && seat !== undefined ? readSeatStyle(seat, seatStyleCache.current) : undefined;
				return {
					type: 'Feature' as const,
					geometry,
					properties: {
						legId: leg.id,
						status: progress.status,
						isFlight,
						color: seatStyle?.color ?? cssVar('--color-link', '#4967aa'),
						dashed: seatStyle?.dashed ?? false
					}
				};
			})
			.filter((f): f is NonNullable<typeof f> => f !== undefined);
		(map.getSource('legs') as GeoJSONSource | undefined)?.setData({
			type: 'FeatureCollection',
			features: legFeatures
		});

		// Single-person for now (explore.astro passes one person's entries) -
		// activeEntries[0] is that person's active entry. The library itself is
		// ready for several; this component isn't rendering group UI yet.
		const activeEntry = entries.find((e) => e.id === state.activeEntries[0]?.id);
		const activeCoords = placeCoords(places, activeEntry?.placeId ?? null);

		if (activeCoords) {
			const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			// A hop that opens a new chapter (its destination's chapter differs
			// from its own - i.e. this leg is literally what starts the chapter)
			// gets the longer cinematic treatment; spec names these as the
			// Denmark->Chapel Hill and US->Singapore hops specifically, and both
			// happen to be exactly this: the flight that opens a chapter.
			const activeLeg = legs.find(
				(l) => l.mode === 'flight' && placeCoords(places, l.toPlaceId)?.join() === activeCoords.join()
			);
			const duration = reducedMotion ? 0 : activeLeg ? CAMERA_CINEMATIC_MS : CAMERA_MOVE_MS;

			// Zooms in on wherever the slider is pointing, rather than fitting the
			// whole revealed-so-far route - the reader is looking at one day at a
			// time (the point of the slider having its own date stamp), not an
			// ever-widening overview. MapLibre's flyTo already arcs out and back
			// in on its own for a long hop (e.g. Denmark to Chapel Hill), which is
			// what gives it the "zooms out, pans, zooms back in" feel on a big
			// jump and a simple, closer pan on a short one. The muted past route
			// and its markers are still drawn (state.visibleMarkers above) and
			// still clickable once a reader zooms out by hand.
			map.flyTo({ center: activeCoords, zoom: MAP_DEFAULT_ZOOM + 5, duration });
		}

		const popup = entryPopupRef.current;
		if (popup && activeCoords && activeEntry) {
			popup.setLngLat(activeCoords).setDOMContent(buildEntryPopupContent(activeEntry)).addTo(map);
		} else {
			popup?.remove();
		}
	}

	/** The active entry's photo + title, following the marker - see entryPopupRef's setup above. */
	function buildEntryPopupContent(entry: ExplorerEntry): HTMLElement {
		const root = document.createElement('a');
		root.className = 'entry-popup-card';
		root.href = `/${lang}/${personSlug}/${entry.slug}`;

		if (entry.thumb) {
			const img = document.createElement('img');
			img.src = entry.thumb;
			img.alt = '';
			if (entry.thumbWidth && entry.thumbHeight) {
				img.style.aspectRatio = `${entry.thumbWidth} / ${entry.thumbHeight}`;
			}
			root.appendChild(img);
		}

		const title = document.createElement('span');
		title.className = 'entry-popup-title';
		title.textContent = entry.title;
		root.appendChild(title);

		return root;
	}

	useEffect(() => {
		// Keeps the URL in sync on every change, including the initial mount -
		// every state has its own URL (spec section 6), not just ones reached by interacting.
		writeDateToUrl(date);
		syncMapToState();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [date]);

	// Resize the map whenever the mobile bottom sheet opens/closes - the
	// canvas is sized by its container (0 while the sheet is collapsed), and
	// MapLibre needs an explicit nudge, both right away and once more after
	// the CSS height transition (--duration-base) actually finishes.
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		map.resize();
		const timeout = setTimeout(() => map.resize(), 260);
		return () => clearTimeout(timeout);
	}, [sheetOpen]);

	// Scroll-sync: the journal cards are server-rendered Astro markup sitting
	// beside this island, not React-owned - observed directly via the DOM.
	// A plain scroll listener picking whichever card's center is nearest the
	// viewport center, rather than IntersectionObserver: a narrow rootMargin
	// band turned out not to reliably fire at all when cards are close
	// together relative to viewport height (caught in e2e testing - the
	// threshold crossing it depends on just never happened in a shorter
	// viewport), and a wider band makes "nearest to center" ambiguous between
	// neighbours. Direct distance comparison has neither problem.
	useEffect(() => {
		const cards = Array.from(document.querySelectorAll<HTMLElement>('.journal-card'));
		if (cards.length === 0) return;

		let ticking = false;
		function updateActiveFromScroll() {
			ticking = false;
			const viewportCenter = window.innerHeight / 2;
			let closest: HTMLElement | undefined;
			let closestDistance = Number.POSITIVE_INFINITY;
			for (const card of cards) {
				const rect = card.getBoundingClientRect();
				const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
				if (distance < closestDistance) {
					closestDistance = distance;
					closest = card;
				}
			}
			const cardDate = closest?.getAttribute('data-date');
			if (cardDate) navigateTo(cardDate, { scrollJournal: false });
		}

		function onScroll() {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(updateActiveFromScroll);
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			e.preventDefault();
			const direction = e.key === 'ArrowRight' ? 'next' : 'previous';
			const next = e.shiftKey
				? adjacentChapterEntryDate(entries, date, direction)
				: adjacentEntryDate(entries, date, direction);
			navigateTo(next);
		}
	}

	const activeIndex = sortedEntries.findIndex((e) => e.id === state.activeEntries[0]?.id);
	const activePlace = places.find((p) => p.id === state.activeEntries[0]?.placeId);

	// "Week 9 · 12 Oct" territory (spec section 6's slider labels), not a full
	// year/weekday - this is a quick stamp next to the thumb, read alongside
	// the place name already shown in the mobile sheet toggle and the journal
	// card beside it.
	const tickDateFormatter = new Intl.DateTimeFormat(lang === 'da' ? 'da-DK' : 'en-US', { day: 'numeric', month: 'short' });
	const sliderMax = Math.max(sortedEntries.length - 1, 0);
	const tickPercent = (index: number) => (sliderMax === 0 ? 0 : (index / sliderMax) * 100);

	return (
		<div className="timeline-explorer">
			<div className={`map-panel${sheetOpen ? ' map-panel--open' : ''}`}>
				<div ref={containerRef} className="map-container" role="application" aria-label="Route map" />
			</div>
			<button
				type="button"
				className="map-sheet-toggle"
				aria-expanded={sheetOpen}
				onClick={() => setSheetOpen((open) => !open)}
			>
				<span className="sheet-toggle-place">{activePlace?.label ?? ''}</span>
				<span className="sheet-toggle-date t-data">{date.slice(0, 10)}</span>
				<span className="sheet-toggle-action">{sheetOpen ? labels.closeMap : labels.openMap}</span>
			</button>
			<div className="slider-controls">
				<button
					type="button"
					onClick={() => navigateTo(adjacentEntryDate(entries, date, 'previous'))}
					disabled={activeIndex <= 0}
				>
					&larr; {labels.previous}
				</button>
				<div className="slider-track">
					<input
						type="range"
						min={0}
						max={sliderMax}
						value={Math.max(activeIndex, 0)}
						onChange={(e) => navigateTo(sortedEntries[Number(e.target.value)]?.occurredAt)}
						onKeyDown={handleKeyDown}
						aria-label="Timeline position"
						aria-valuetext={activeIndex >= 0 ? tickDateFormatter.format(new Date(sortedEntries[activeIndex].occurredAt)) : undefined}
					/>
					<div className="slider-ticks" aria-hidden="true">
						{sortedEntries.map((entry, i) => (
							<span
								key={entry.id}
								className={i === activeIndex ? 'slider-tick slider-tick--active' : 'slider-tick'}
								style={{ left: `${tickPercent(i)}%` }}
							/>
						))}
					</div>
					{activeIndex >= 0 && (
						<div className="slider-date-stamp t-data" aria-hidden="true" style={{ left: `${tickPercent(activeIndex)}%` }}>
							{tickDateFormatter.format(new Date(sortedEntries[activeIndex].occurredAt))}
						</div>
					)}
				</div>
				<button
					type="button"
					onClick={() => navigateTo(adjacentEntryDate(entries, date, 'next'))}
					disabled={activeIndex >= sortedEntries.length - 1}
				>
					{labels.next} &rarr;
				</button>
			</div>
		</div>
	);
}
