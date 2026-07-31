import { open } from 'node:fs/promises';
import path from 'node:path';

const filePath = path.resolve('static/via-ferrata.pmtiles');

function parseRange(value, size) {
	if (!value?.startsWith('bytes=')) return null;
	const [startValue, endValue] = value.slice(6).split('-', 2);
	let start = startValue ? Number(startValue) : NaN;
	let end = endValue ? Number(endValue) : size - 1;

	if (!Number.isFinite(start)) {
		const suffixLength = Number(endValue);
		if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
		start = Math.max(size - suffixLength, 0);
		end = size - 1;
	}

	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
		return null;
	}

	return { start, end: Math.min(end, size - 1) };
}

async function serve({ request }) {
	const file = await open(filePath, 'r');
	try {
		const { size } = await file.stat();
		const range = parseRange(request.headers.get('range'), size);
		const start = range?.start ?? 0;
		const end = range?.end ?? size - 1;
		const length = end - start + 1;
		const headers = {
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=3600',
			'Content-Length': String(length),
			'Content-Type': 'application/octet-stream'
		};

		if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
		if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });

		const buffer = Buffer.allocUnsafe(length);
		await file.read(buffer, 0, length, start);
		return new Response(buffer, { status: range ? 206 : 200, headers });
	} finally {
		await file.close();
	}
}

export const GET = serve;
export const HEAD = serve;
