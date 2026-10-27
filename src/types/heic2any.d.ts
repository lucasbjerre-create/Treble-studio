// No official types (and no @types/heic2any) - just the one function this
// project actually calls, from the package's own README.
declare module 'heic2any' {
	interface Heic2AnyOptions {
		blob: Blob;
		toType?: string;
		quality?: number;
	}

	export default function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>;
}
