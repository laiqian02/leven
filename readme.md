# leven

> Measure the difference between two strings using the [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance) algorithm

## Install

```sh
npm install github:laiqian02/leven
```

## Short-string performance in this fork

Ranking eight misspelled command queries against eight command labels took **90.3% less time per exact distance calculation** in a local run. This workload calls `leven` on all 64 pairs to obtain every score. It measures the scoring step of a command palette.

After trimming shared prefixes and suffixes, the fork uses Myers' bit-vector algorithm when the shorter input has 8–32 UTF-16 code units and the caller requests an exact distance. A 32-bit word tracks the entire short side of the comparison. The first use allocates a reusable 256 KiB character table. For capped comparisons, reaching the cap with a proven lower bound now returns immediately.

| Workload | Upstream (ns/pair) | Fork (ns/pair) | Elapsed time change |
| --- | ---: | ---: | ---: |
| Rank command labels, exact | 1240.2 | 119.8 | 90.3% less |
| Same labels, distance capped at 2 | 61.1 | 35.1 | 42.5% less |
| Short words (3–7 code units) | 41.3 | 42.2 | 2.1% more |
| Long titles (33–64 code units) | 2263.7 | 2288.4 | 1.1% more |

The table shows the third of three runs on Windows x64, Node.js 24.15.0, Intel Core i7-14700KF. Each run checks every pair against upstream commit `0c8c7f4`, warms both versions, alternates execution order and reports the median of nine rounds per version. Across the three runs, the exact command workload took 89.8–90.5% less time. The short-word workload took 2.1–5.6% more time. Long-title results varied from 2.3% less to 8.7% more time.

To reproduce the comparison, run these commands with Node.js 24 and Git.

```sh
git clone https://github.com/laiqian02/leven.git
cd leven
node --test test.js
node benchmark-short.js
```

## Usage

```js
import leven from 'leven';

leven('cat', 'cow');
//=> 2
```

## API

### leven(first, second, options?)

#### first

Type: `string`

First string.

#### second

Type: `string`

Second string.

#### options

Type: `object`

##### maxDistance

Type: `number`

Maximum distance to calculate.

If the actual distance exceeds this value, the function will return `maxDistance` instead of the actual distance. This can significantly improve performance when you only care about matches within a certain threshold.

Negative and non-integer values are ignored, and the distance is then not capped.

> [!TIP]
> Without `maxDistance`, the time grows with the product of the string lengths, so two long strings can block for seconds. With it, the time grows only with the string length times `maxDistance`. Set it for untrusted input.

```js
import leven from 'leven';

leven('abcdef', '123456', {maxDistance: 3});
//=> 3

leven('cat', 'cow', {maxDistance: 5});
//=> 2
```

### closestMatch(target, candidates, options?)

Find the closest matching string from an array of candidates.

#### target

Type: `string`

The string to find matches for.

#### candidates

Type: `string[]`

Array of candidate strings to search through.

#### options

Type: `object`

Same options as `leven()`.

##### maxDistance

Type: `number`

Maximum distance to consider. Candidates with a distance greater than this value will be ignored.

Returns the closest matching string from candidates, or `undefined` if no candidates are provided or if no match is found within `maxDistance`.

```js
import {closestMatch} from 'leven';

closestMatch('kitten', ['sitting', 'kitchen', 'mittens']);
//=> 'kitchen'

closestMatch('hello', ['jello', 'yellow', 'bellow'], {maxDistance: 2});
//=> 'jello'

// No match within distance threshold
closestMatch('abcdef', ['123456', '1234567890'], {maxDistance: 2});
//=> undefined
```

## Related

- [leven-cli](https://github.com/sindresorhus/leven-cli) - CLI for this module
