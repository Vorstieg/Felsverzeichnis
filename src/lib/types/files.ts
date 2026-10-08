import type { FelsEntry } from '@vorstieg/fels-types/types';

/** Location supplied by the file API, independent of persisted entry properties. */
export interface FelsLocation {
	entry: FelsEntry;
	path: string;
}

/** A file API directory listing item. Paths are relative to the requested directory. */
export interface DirectoryEntry {
	name: string;
	path: string;
	type: 'file' | 'dir';
}
