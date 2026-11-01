import { useRef, useState } from 'react';
import './PhotoPeopleTags.css';
import { detectFaceBoxes } from '../lib/faceDetection';
import { pixelRectToFraction, rectFromPoints, type FractionBox } from '../lib/boxes';

export interface PersonTag {
	id: number;
	name: string;
	boxX: number;
	boxY: number;
	boxW: number;
	boxH: number;
}

interface TaggableMedia {
	id: number;
	keyThumb: string | null;
	keyDisplay: string | null;
	people: PersonTag[];
}

interface Props {
	media: TaggableMedia;
	/** Names already typed on any of this person's own photos before - autocomplete only, any new name is accepted too. */
	knownNames: string[];
	onChange: (people: PersonTag[]) => void;
}

function fractionBoxStyle(box: FractionBox): React.CSSProperties {
	return { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` };
}

// The name-entry form anchors at a box's top-left corner but sizes itself
// (min-width in the stylesheet) rather than being squeezed into a small
// detected face's own width/height.
function anchorStyle(box: FractionBox): React.CSSProperties {
	return { left: `${box.x * 100}%`, top: `${box.y * 100}%` };
}

// The in-progress drag rect is tracked in wrapper-relative pixels (it has no
// fixed container to take a fraction of until the drag ends), so it's
// positioned in px, not %, unlike every other box here.
function pixelBoxStyle(box: FractionBox): React.CSSProperties {
	return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` };
}

/**
 * Per-photo face tagging: a "Detect faces" button finds candidate boxes
 * on-device (never identity, just a box - src/lib/faceDetection.ts), and a
 * free-text name turns one into a tag. No account, no email, no
 * notification - a tag is just a name string on a box (studio prompt).
 */
export default function PhotoPeopleTags({ media, knownNames, onChange }: Props) {
	const [open, setOpen] = useState(false);
	const [detecting, setDetecting] = useState(false);
	const [detectError, setDetectError] = useState<string | null>(null);
	const [pending, setPending] = useState<FractionBox[]>([]);
	const [namingIndex, setNamingIndex] = useState<number | null>(null);
	const [nameInput, setNameInput] = useState('');
	const [saving, setSaving] = useState(false);
	const [drawing, setDrawing] = useState(false);
	const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
	const [liveDrag, setLiveDrag] = useState<FractionBox | null>(null);

	const imgRef = useRef<HTMLImageElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);

	const imageKey = media.keyDisplay ?? media.keyThumb;

	async function runDetection() {
		if (!imgRef.current) return;
		setDetecting(true);
		setDetectError(null);
		try {
			const boxes = await detectFaceBoxes(imgRef.current);
			if (boxes.length === 0) setDetectError('No faces found - you can still add one by hand.');
			setPending((prev) => [...prev, ...boxes]);
		} catch {
			setDetectError('Face detection could not load. You can still add a box by hand.');
		} finally {
			setDetecting(false);
		}
	}

	function pointFromEvent(e: React.PointerEvent): { x: number; y: number } {
		const rect = wrapperRef.current!.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	function onPointerDown(e: React.PointerEvent) {
		if (!drawing) return;
		// Without this, the browser's own "drag this image" gesture (ghost
		// thumbnail, drop-to-bookmark-bar) competes with drawing a box - on a
		// real photo it usually wins, which is what "dragging the image
		// instead of a box" was. draggable={false} on the <img> below stops it
		// from starting at all; this is a second guard for a pointerdown that
		// still reaches here before that takes effect.
		e.preventDefault();
		const p = pointFromEvent(e);
		setDragStart(p);
		setLiveDrag({ x: p.x, y: p.y, w: 0, h: 0 });
	}

	function onPointerMove(e: React.PointerEvent) {
		if (!drawing || !dragStart) return;
		const p = pointFromEvent(e);
		setLiveDrag(rectFromPoints(dragStart.x, dragStart.y, p.x, p.y));
	}

	function onPointerUp() {
		if (!drawing || !dragStart || !liveDrag || !wrapperRef.current) return;
		const rect = wrapperRef.current.getBoundingClientRect();
		if (liveDrag.w > 8 && liveDrag.h > 8) {
			setPending((prev) => [...prev, pixelRectToFraction(liveDrag, rect.width, rect.height)]);
		}
		setDragStart(null);
		setLiveDrag(null);
		setDrawing(false);
	}

	function discardPending(index: number) {
		setPending((prev) => prev.filter((_, i) => i !== index));
		setNamingIndex(null);
		setNameInput('');
	}

	async function saveName() {
		if (namingIndex == null) return;
		const name = nameInput.trim();
		if (!name) {
			discardPending(namingIndex);
			return;
		}
		const box = pending[namingIndex];
		setSaving(true);
		try {
			const res = await fetch(`/api/studio/media/${media.id}/people`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, boxX: box.x, boxY: box.y, boxW: box.w, boxH: box.h })
			});
			if (!res.ok) throw new Error('Could not save that tag');
			const tag = (await res.json()) as PersonTag;
			onChange([...media.people, tag]);
			discardPending(namingIndex);
		} catch {
			// Left in place (still in pending) so Lucas can just try again.
		} finally {
			setSaving(false);
		}
	}

	async function removeTag(tagId: number) {
		const res = await fetch(`/api/studio/media/${media.id}/people/${tagId}`, { method: 'DELETE' });
		if (res.ok) onChange(media.people.filter((p) => p.id !== tagId));
	}

	if (!imageKey) return null;

	return (
		<div className="photo-people-tags">
			<button type="button" className="link-button" onClick={() => setOpen((v) => !v)}>
				{open ? 'Hide people' : media.people.length > 0 ? `People (${media.people.length})` : 'Tag people'}
			</button>

			{open && (
				<div className="people-tagger">
					<div className="people-tagger-toolbar">
						<button type="button" onClick={runDetection} disabled={detecting}>
							{detecting ? 'Detecting…' : 'Detect faces'}
						</button>
						<button
							type="button"
							className={drawing ? 'active' : ''}
							onClick={() => setDrawing((v) => !v)}
						>
							{drawing ? 'Click and drag on the photo…' : '+ Add a person by hand'}
						</button>
					</div>
					{detectError && <p className="hint">{detectError}</p>}

					<div
						ref={wrapperRef}
						className="people-tagger-image"
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					>
						<img ref={imgRef} src={`/api/studio/media-file/${imageKey}`} alt="" draggable={false} />

						{media.people.map((tag) => (
							<div
								key={tag.id}
								className="face-box face-box--named"
								style={fractionBoxStyle({ x: tag.boxX, y: tag.boxY, w: tag.boxW, h: tag.boxH })}
							>
								<button type="button" className="face-chip" onClick={() => removeTag(tag.id)}>
									{tag.name} ×
								</button>
							</div>
						))}

						{pending.map((box, index) =>
							index === namingIndex ? (
								<form
									key={index}
									className="face-name-form"
									style={anchorStyle(box)}
									onSubmit={(e) => {
										e.preventDefault();
										void saveName();
									}}
								>
									<input
										autoFocus
										value={nameInput}
										onChange={(e) => setNameInput(e.target.value)}
										onBlur={() => {
											if (!nameInput.trim()) discardPending(index);
										}}
										list="known-people-names"
										placeholder="Name"
										disabled={saving}
									/>
								</form>
							) : (
								<button
									key={index}
									type="button"
									className="face-box face-box--pending"
									style={fractionBoxStyle(box)}
									onClick={() => {
										setNamingIndex(index);
										setNameInput('');
									}}
								>
									+
								</button>
							)
						)}

						{liveDrag && <div className="face-box face-box--drawing" style={pixelBoxStyle(liveDrag)} />}
					</div>

					<datalist id="known-people-names">
						{knownNames.map((name) => (
							<option key={name} value={name} />
						))}
					</datalist>
				</div>
			)}
		</div>
	);
}
