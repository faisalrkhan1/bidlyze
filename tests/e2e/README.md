# Known-answer tender test

`ECTA_test_tender.pdf` is a fictional 8-page tender (made by `make_tender.py`)
with every answer known in advance (`ground_truth.json`):

- 16 GCC disqualification items the tender requires, each on a known page
- 4 items the tender does not mention (must not be flagged as required)
- 3 key dates (site visit, clarification deadline, closing)
- 2 traps that should produce clarification questions:
  an unnamed integration platform (p.4) and a 2,400 vs 2,600 sensor quantity conflict (p.7)
- 1 sentence that runs across a page break with a "Page 5 of 8" footer in the middle

Run it through Bidlyze as a normal upload, export the analysis and its
disqualification record as `{ "analysis_data": …, "disqualification": … }`, then:

```
node tests/e2e/score.mjs result.json
```

The score shows recall of the 16 required items, correct page citations,
false alarms on the 4 absent items, key dates found, clarification traps
caught, citation verification counts, and the AI cost of the run.

Offline unit tests for citation checking: `npm test`.
