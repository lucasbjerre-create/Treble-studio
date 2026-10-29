import { useState } from 'react';
import './EntryList.css';
import { daysUntilDraftExpiry } from '../lib/draftExpiry';

export interface EntryRow {
	id: number;
	title: string;
	status: string;
	occurredAt: string;
	createdAt: string;
	/** Null for a draft that's never been published - the only kind sweepStaleDrafts ever auto-deletes (entryDeletion.ts). Set (and left alone by /unpublish) for one that has been, which is exempt regardless of age. */
	publishedAt: string | null;
}

interface Props {
	entries: EntryRow[];
}

function expiryLabel(createdAt: string, now: string): string {
	const days = daysUntilDraftExpiry(createdAt, now);
	if (days <= 0) return 'auto-deletes today';
	if (days === 1) return 'auto-deletes tomorrow';
	return `auto-deletes in ${days} days`;
}

function without(set: Set<number>, id: number): Set<number> {
	const next = new Set(set);
	next.delete(id);
	return next;
}

/**
 * The entries list's own delete UI - per-row delete, select-some-or-all,
 * and bulk delete. studio/index.astro keeps the page chrome and the
 * "Nothing yet" case server-rendered; this island only adds the
 * destructive actions on top of the same rows it was handed.
 */
export default function EntryList({ entries: initialEntries }: Props) {
	const [entries, setEntries] = useState(initialEntries);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
	const [bulkDeleting, setBulkDeleting] = useState(false);
	const [bulkUnpublishing, setBulkUnpublishing] = useState(false);
	const [unpublishingIds, setUnpublishingIds] = useState<Set<number>>(new Set());
	const [error, setError] = useState<string | null>(null);
	// Fixed at mount, not recomputed per render - a countdown that's exact to
	// the second would contradict "a simple day countdown, not minutes or hours".
	const [now] = useState(() => new Date().toISOString());

	function toggle(id: number) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	/**
	 * Selects (or, if every entry of this status is already selected,
	 * deselects) only the entries with this one status, leaving any other
	 * selected entries alone - drafts and published are picked separately on
	 * purpose, so "select everything" is never one click away from bulk
	 * deleting or unpublishing real, live content by mistake.
	 */
	function toggleAllOfStatus(status: string) {
		const idsOfStatus = entries.filter((e) => e.status === status).map((e) => e.id);
		const allSelected = idsOfStatus.length > 0 && idsOfStatus.every((id) => selected.has(id));
		setSelected((prev) => {
			const next = new Set(prev);
			for (const id of idsOfStatus) {
				if (allSelected) next.delete(id);
				else next.add(id);
			}
			return next;
		});
	}

	async function deleteOne(entry: EntryRow) {
		if (!window.confirm(`Delete "${entry.title}"? This can't be undone.`)) return;
		setDeletingIds((prev) => new Set(prev).add(entry.id));
		setError(null);
		try {
			const res = await fetch(`/api/studio/entries/${entry.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(`Delete failed (${res.status})`);
			setEntries((prev) => prev.filter((e) => e.id !== entry.id));
			setSelected((prev) => without(prev, entry.id));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Delete failed');
		} finally {
			setDeletingIds((prev) => without(prev, entry.id));
		}
	}

	async function deleteSelected() {
		if (selected.size === 0) return;
		const count = selected.size;
		if (!window.confirm(`Delete ${count} ${count === 1 ? 'entry' : 'entries'}? This can't be undone.`)) return;
		setBulkDeleting(true);
		setError(null);
		try {
			const res = await fetch('/api/studio/entries/bulk-delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: Array.from(selected) })
			});
			if (!res.ok) throw new Error(`Delete failed (${res.status})`);
			const { deleted } = (await res.json()) as { deleted: number[] };
			setEntries((prev) => prev.filter((e) => !deleted.includes(e.id)));
			setSelected(new Set());
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Delete failed');
		} finally {
			setBulkDeleting(false);
		}
	}

	/** Takes a published entry back to draft - hidden from public/family, nothing deleted, publishable again later. */
	async function unpublishOne(entry: EntryRow) {
		setUnpublishingIds((prev) => new Set(prev).add(entry.id));
		setError(null);
		try {
			const res = await fetch(`/api/studio/entries/${entry.id}/unpublish`, { method: 'POST' });
			if (!res.ok) throw new Error(`Unpublish failed (${res.status})`);
			setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'draft' } : e)));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unpublish failed');
		} finally {
			setUnpublishingIds((prev) => without(prev, entry.id));
		}
	}

	async function unpublishSelected() {
		if (selected.size === 0) return;
		setBulkUnpublishing(true);
		setError(null);
		try {
			const res = await fetch('/api/studio/entries/bulk-unpublish', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: Array.from(selected) })
			});
			if (!res.ok) throw new Error(`Unpublish failed (${res.status})`);
			const { unpublished } = (await res.json()) as { unpublished: number[] };
			setEntries((prev) => prev.map((e) => (unpublished.includes(e.id) ? { ...e, status: 'draft' } : e)));
			setSelected(new Set());
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unpublish failed');
		} finally {
			setBulkUnpublishing(false);
		}
	}

	if (entries.length === 0) return <p>Nothing yet.</p>;

	const draftCount = entries.filter((e) => e.status === 'draft').length;
	const publishedCount = entries.filter((e) => e.status === 'published').length;
	const draftsSelected = entries.filter((e) => e.status === 'draft').every((e) => selected.has(e.id));
	const publishedSelected = entries.filter((e) => e.status === 'published').every((e) => selected.has(e.id));

	return (
		<div className="entry-list-wrap">
			<div className="bulk-bar">
				<label className="select-all">
					<input
						type="checkbox"
						checked={draftCount > 0 && draftsSelected}
						onChange={() => toggleAllOfStatus('draft')}
						disabled={draftCount === 0}
					/>
					Select all drafts ({draftCount})
				</label>
				<label className="select-all">
					<input
						type="checkbox"
						checked={publishedCount > 0 && publishedSelected}
						onChange={() => toggleAllOfStatus('published')}
						disabled={publishedCount === 0}
					/>
					Select all published ({publishedCount})
				</label>
				<button type="button" onClick={deleteSelected} disabled={selected.size === 0 || bulkDeleting}>
					{bulkDeleting ? 'Deleting…' : `Delete selected (${selected.size})`}
				</button>
				<button
					type="button"
					onClick={unpublishSelected}
					disabled={selected.size === 0 || bulkUnpublishing}
					title="Takes selected entries back to draft, hidden from public - nothing is deleted"
				>
					{bulkUnpublishing ? 'Unpublishing…' : `Unpublish selected (${selected.size})`}
				</button>
			</div>

			{error && <p className="error">{error}</p>}

			<ul className="entry-list">
				{entries.map((entry) => (
					<li key={entry.id}>
						<input
							type="checkbox"
							checked={selected.has(entry.id)}
							onChange={() => toggle(entry.id)}
							aria-label={`Select ${entry.title}`}
						/>
						<a href={`/studio/entries/${entry.id}`}>
							<span className="status" data-status={entry.status}>
								{entry.status}
							</span>
							<span className="title">{entry.title}</span>
							<span className="date">{entry.occurredAt.slice(0, 10)}</span>
							{entry.status === 'draft' && entry.publishedAt === null && (
							<span className="expiry">{expiryLabel(entry.createdAt, now)}</span>
						)}
						{entry.status === 'draft' && entry.publishedAt !== null && (
							<span className="expiry">unpublished - won't auto-delete</span>
						)}
						</a>
						{entry.status === 'published' && (
							<button
								type="button"
								className="unpublish-one"
								onClick={() => unpublishOne(entry)}
								disabled={unpublishingIds.has(entry.id)}
								aria-label={`Unpublish ${entry.title}`}
								title="Takes this entry back to draft, hidden from public - nothing is deleted"
							>
								{unpublishingIds.has(entry.id) ? '…' : 'Unpublish'}
							</button>
						)}
						<button
							type="button"
							className="delete-one"
							onClick={() => deleteOne(entry)}
							disabled={deletingIds.has(entry.id)}
							aria-label={`Delete ${entry.title}`}
						>
							{deletingIds.has(entry.id) ? '…' : '✕'}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
