import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import process from 'node:process';
import current from './index.js';

// Run with node benchmark-short.js from a clone containing the upstream commit.
const revision = '0c8c7f459c3bf29fcf4a0c679f7cced3c6c28a53';
const source = execFileSync('git', ['show', `${revision}:index.js`], {cwd: new URL('.', import.meta.url)});
const {default: baseline} = await import(`data:text/javascript;base64,${source.toString('base64')}`);

// Model ranking every command by exact distance, including the intended command
// as well as unrelated alternatives. Commands and misspellings are fixed inputs.
const commands = [
	'Configure workspace settings',
	'Generate project summary',
	'Navigate to previous result',
	'Update account preferences',
	'Import existing document',
	'Restore previous session',
	'Rebuild search index',
	'Download selected files',
];
const queries = [
	'configure worksapce settings',
	'generate projet sumary',
	'navigate to prevous results',
	'update account prefernces',
	'import exsting documents',
	'restore previus sesion',
	'rebuild serach indexes',
	'download selectd file',
];
const commandPairs = queries.flatMap(query => commands.map(command => [query, command]));

const workloads = [
	{name: 'Command ranking (16-32)', pairs: commandPairs},
	{name: 'Short words (3-7)', pairs: [['plan', 'plant'], ['kitten', 'sitting'], ['cargo', 'crane'], ['dog', 'cat']]},
	{
		name: 'Long titles (33-64)',
		pairs: [
			['Configure workspace settings for this project', 'Update account preferences across all devices'],
			['Restore previous session after restarting the editor', 'Navigate to previous search result in the current file'],
			['How to download the selected documents', 'Steps to import files from another workspace'],
		],
	},
	{name: 'Command ranking, cap 2', pairs: commandPairs, options: {maxDistance: 2}},
];

function measure(distance, {pairs, options}, batches, expectedSum) {
	let sum = 0;
	const start = performance.now();
	for (let index = 0; index < batches; index++) {
		for (const [first, second] of pairs) {
			sum += distance(first, second, options);
		}
	}

	const elapsed = performance.now() - start;
	assert.equal(sum, expectedSum * batches);
	return elapsed;
}

function median(samples) {
	return samples.toSorted((a, b) => a - b)[Math.floor(samples.length / 2)];
}

console.log(`Node ${process.version}, ${process.platform}/${process.arch}; upstream ${revision}`);
console.log('Median of 9 alternating-order rounds, nanoseconds per comparison.');
for (const workload of workloads) {
	const {name, pairs, options} = workload;
	let expectedSum = 0;
	for (const [first, second] of pairs) {
		const expected = baseline(first, second, options);
		assert.equal(current(first, second, options), expected);
		expectedSum += expected;
	}

	// Calibrate once against the baseline; both versions do identical work.
	let batches = 1;
	while (measure(baseline, workload, batches, expectedSum) < 50) {
		batches *= 2;
	}

	measure(current, workload, batches, expectedSum);
	const results = new Map([[baseline, []], [current, []]]);
	for (let round = 0; round < 9; round++) {
		const order = round % 2 === 0 ? [baseline, current] : [current, baseline];
		for (const distance of order) {
			results.get(distance).push(measure(distance, workload, batches, expectedSum));
		}
	}

	const comparisons = pairs.length * batches;
	const before = median(results.get(baseline)) * 1e6 / comparisons;
	const after = median(results.get(current)) * 1e6 / comparisons;
	const reduction = (1 - (after / before)) * 100;
	console.log(`${name}: ${before.toFixed(1)} -> ${after.toFixed(1)} ns, ${reduction.toFixed(1)}% less time (${comparisons} comparisons/round)`);
}
