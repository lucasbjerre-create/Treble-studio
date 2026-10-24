import { greatCircle } from '@turf/great-circle';
import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// The `?worker&url` suffix matters: plain `?url` omits a sibling chunk the
// worker needs, which works in dev but 404s in a production build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'react';
import './TimelineExplorer.css';
import { CAMERA_CINEMATIC_MS, CAMERA_MOVE_MS, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_STYLE_URL } from '../config/map';
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

interface Props {
	entries: ExplorerEntry[];
	legs: ExplorerLeg[];
	places: ExplorerPlace[];
	labels: { previous: string; next: string };
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

export default function TimelineExplorer({ entries, legs, places, labels }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibreMap | null>(null);

	const sortedEntries = [...entries].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
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
		if (options.scrollJournal !== false) {
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
		});
		mapRef.current = map;
		// e2e-test-only accessor: a WebGL canvas has no inspectable DOM content,
		// so the explore.spec.ts test uses this to compute a marker's real pixel
		// position via map.project() rather than guessing coordinates.
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

			const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#b3473f';
			const muted = getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim() || '#6b7280';

			map.addLayer({
				id: 'legs-line',
				type: 'line',
				source: 'legs',
				layout: { 'line-cap': 'round' },
				paint: {
					'line-color': ['case', ['==', ['get', 'status'], 'current'], accent, muted],
					'line-width': ['case', ['==', ['get', 'status'], 'current'], 3, 1.5],
					'line-opacity': ['case', ['==', ['get', 'status'], 'current'], 1, 0.6]
				}
			});

			map.addLayer({
				id: 'clusters',
				type: 'circle',
				source: 'markers',
				filter: ['has', 'point_count'],
				paint: { 'circle-color': muted, 'circle-radius': 14, 'circle-opacity': 0.85 }
			});
			map.addLayer({
				id: 'cluster-count',
				type: 'symbol',
				source: 'markers',
				filter: ['has', 'point_count'],
				layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
				paint: { 'text-color': '#ffffff' }
			});
			map.addLayer({
				id: 'marker-point',
				type: 'circle',
				source: 'markers',
				filter: ['!', ['has', 'point_count']],
				paint: {
					'circle-color': ['case', ['get', 'isActive'], accent, muted],
					'circle-radius': ['case', ['get', 'isActive'], 8, 5],
					'circle-stroke-width': 2,
					'circle-stroke-color': '#ffffff'
				}
			});

			map.on('click', 'marker-point', (e) => {
				const entryId = e.features?.[0]?.properties?.entryId;
				const entry = entries.find((en) => en.id === entryId);
				if (entry) navigateTo(entry.occurredAt);
			});
			map.on('mouseenter', 'marker-point', () => {
				map.getCanvas().style.cursor = 'pointer';
			});
			map.on('mouseleave', 'marker-point', () => {
				map.getCanvas().style.cursor = '';
			});

			syncMapToState();
		});

		// Stop automatic camera movement as soon as the reader touches the map (CLAUDE.md).
		map.on('dragstart', () => {
			map.stop();
		});

		return () => {
			map.remove();
			mapRef.current = null;
			delete (window as unknown as { __explorerMap?: MapLibreMap }).__explorerMap;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function syncMapToState() {
		const map = mapRef.current;
		if (!map || !map.isStyleLoaded()) return;

		const markerFeatures = state.visibleMarkers
			.map((marker) => {
				const coords = placeCoords(places, marker.placeId);
				if (!coords) return undefined;
				return {
					type: 'Feature' as const,
					geometry: { type: 'Point' as const, coordinates: coords },
					properties: { entryId: marker.entryId, isActive: marker.isActive }
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
				const geometry =
					leg.mode === 'flight'
						? greatCircle(from, to).geometry
						: { type: 'LineString' as const, coordinates: [from, to] };
				return {
					type: 'Feature' as const,
					geometry,
					properties: { legId: leg.id, status: progress.status }
				};
			})
			.filter((f): f is NonNullable<typeof f> => f !== undefined);
		(map.getSource('legs') as GeoJSONSource | undefined)?.setData({
			type: 'FeatureCollection',
			features: legFeatures
		});

		// Frames the whole revealed-so-far route (not just the active point) so
		// every visible marker stays clickable, not just the latest one.
		const visibleCoords = state.visibleMarkers
			.map((m) => placeCoords(places, m.placeId))
			.filter((c): c is [number, number] => c !== undefined);

		if (visibleCoords.length > 0) {
			const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			// Single-person for now (explore.astro passes one person's entries) -
			// activeEntries[0] is that person's active entry. The library itself
			// is ready for several; this component isn't rendering group UI yet.
			const activeCoords = placeCoords(places, state.activeEntries[0]?.placeId ?? null);
			// A hop that opens a new chapter (its destination's chapter differs
			// from its own - i.e. this leg is literally what starts the chapter)
			// gets the longer cinematic treatment; spec names these as the
			// Denmark->Chapel Hill and US->Singapore hops specifically, and both
			// happen to be exactly this: the flight that opens a chapter.
			const activeLeg = legs.find(
				(l) => l.mode === 'flight' && activeCoords && placeCoords(places, l.toPlaceId)?.join() === activeCoords.join()
			);
			const duration = reducedMotion ? 0 : activeLeg ? CAMERA_CINEMATIC_MS : CAMERA_MOVE_MS;

			if (visibleCoords.length === 1) {
				map.flyTo({ center: visibleCoords[0], zoom: MAP_DEFAULT_ZOOM + 5, duration });
			} else {
				const lons = visibleCoords.map((c) => c[0]);
				const lats = visibleCoords.map((c) => c[1]);
				map.fitBounds(
					[
						[Math.min(...lons), Math.min(...lats)],
						[Math.max(...lons), Math.max(...lats)]
					],
					{ padding: 60, duration, maxZoom: MAP_DEFAULT_ZOOM + 6 }
				);
			}
		}
	}

	useEffect(() => {
		// Keeps the URL in sync on every change, including the initial mount -
		// every state has its own URL (spec section 6), not just ones reached by interacting.
		writeDateToUrl(date);
		syncMapToState();
	}, [date]);

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

	return (
		<div className="timeline-explorer">
			<div ref={containerRef} className="map-container" role="application" aria-label="Route map" />
			<div className="slider-controls">
				<button
					type="button"
					onClick={() => navigateTo(adjacentEntryDate(entries, date, 'previous'))}
					disabled={activeIndex <= 0}
				>
					&larr; {labels.previous}
				</button>
				<input
					type="range"
					min={0}
					max={Math.max(sortedEntries.length - 1, 0)}
					value={Math.max(activeIndex, 0)}
					onChange={(e) => navigateTo(sortedEntries[Number(e.target.value)]?.occurredAt)}
					onKeyDown={handleKeyDown}
					aria-label="Timeline position"
				/>
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
