export interface Heading { level: number; title: string; line: number; end: number }
export interface Block { line: number; lines: string[]; path: string[] }
/** Headings outside code fences (see doc.mjs). */
export function headings(text: string): Heading[]
/** Sections whose heading has every word of `query`. */
export function sections(text: string, query: string): { heading: Heading; text: string }[]
/** Paragraphs, list items, table rows, fences and headings, with their heading path. */
export function blocks(text: string): Block[]
/** Blocks containing `phrase`, case and whitespace ignored. */
export function grepBlocks(text: string, phrase: string): Block[]
