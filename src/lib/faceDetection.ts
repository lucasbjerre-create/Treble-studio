// Browser-only (dynamic-imports a large WASM runtime from a CDN, decodes
// pixels) - not Node-testable the way src/lib's other pure functions are,
// same reasoning as media.ts/mediaUpload.ts.
//
// Detection only, never recognition: this never says WHO is in a box, only
// where one might be, and nothing about the photo is sent anywhere - the
// model runs entirely on-device. See src/db/schema.ts's mediaPeople comment
// and .claude/rules/studio.md.
import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { FractionBox } from './boxes';
import { pixelRectToFraction } from './boxes';

// Pinned, not "@latest" - the model asset path below is pinned the same way,
// so a face box's meaning never shifts under an unrelated page load.
const TASKS_VISION_VERSION = '1.1.1';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
// BlazeFace (full-range), not (short-range): short-range is trained for
// selfie-style shots within ~2m of a front-facing camera and, verified
// directly against this project's own real back-camera group photos, missed
// every face but the nearest one. Full-range is the variant Google's own
// guide names for "images from a smartphone camera... back-facing" with
// "single or multiple faces" - exactly this studio's photos.
const MODEL_URL =
	'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite';

// Module-level singleton: the ~13.5MB WASM runtime is fetched at most once
// per page session (then cached by the browser), not once per photo.
let detectorPromise: Promise<FaceDetector> | null = null;

async function getDetector(): Promise<FaceDetector> {
	if (!detectorPromise) {
		detectorPromise = (async () => {
			const { FaceDetector: Detector, FilesetResolver } = await import('@mediapipe/tasks-vision');
			const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
			return Detector.createFromOptions(fileset, {
				baseOptions: { modelAssetPath: MODEL_URL },
				runningMode: 'IMAGE'
			});
		})().catch((err) => {
			// A rejected promise is still truthy, so without this a single
			// transient failure (a flaky CDN fetch of the ~13.5MB WASM runtime,
			// easy to hit from a phone on Sunday-in-/studio cellular) would
			// permanently poison every later "Detect faces" click for the rest
			// of the page session, not just that one - this is what "works
			// sometimes" actually was. Resetting here means the next attempt
			// starts fresh instead of replaying the same cached rejection.
			detectorPromise = null;
			throw err;
		});
	}
	return detectorPromise;
}

/**
 * Runs face detection on an already-loaded <img>, on-device. Returns boxes
 * as fractions of the image's own pixels, so they still line up whichever
 * of the three stored sizes is shown later.
 */
export async function detectFaceBoxes(image: HTMLImageElement): Promise<FractionBox[]> {
	await image.decode().catch(() => undefined);
	const detector = await getDetector();
	const { detections } = detector.detect(image);
	return detections
		.map((d) => d.boundingBox)
		.filter((box): box is NonNullable<typeof box> => box != null)
		.map((box) =>
			pixelRectToFraction(
				{ x: box.originX, y: box.originY, w: box.width, h: box.height },
				image.naturalWidth,
				image.naturalHeight
			)
		);
}
