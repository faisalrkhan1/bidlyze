# Findings log: Alton benchmark

Each finding records how it was found, its root cause (extraction / prompt / AI reasoning /
deterministic validation / answer key) and whether it was fixed.

## Found during construction (before any AI run)

- **F0-1 Tender extraction drops text on page 4.** The live extraction reads
  "by 4:30pm on Friday 14th August\nposting or emailing", so the year and a word or two are
  missing from that line. Page 7 restates the date in full ("Friday 14th August 2026").
  Cause: extraction (PDF text layer). Impact: low, because the deadline is restated. Not fixed;
  it shows that real PDFs lose text.
- **F0-2 Code checks treat "within N hours/days" as a minimum.** The value checker reads a
  number as a minimum unless words such as "maximum" or "not exceed" appear before it.
  "within 24 hours" is a maximum. A response promising "within 48 hours" therefore passes the
  check, and a better promise such as "within 12 hours" would be marked a conflict. Cause:
  deterministic validation. Found by code review, to be confirmed by the live runs (A15, A16).
- **F0-3 Offline perfect-reviewer test.** The answer key's own verdicts and quotes were passed
  through the real pipeline. The code checks changed none of the 38 verdicts, and all 4
  two-sided contradictions keep both quotes.
