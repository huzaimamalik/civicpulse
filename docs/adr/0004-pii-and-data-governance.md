# ADR-0004: PII and Data Governance

## Status

Accepted. Provider terms verified 2026-09-28.

## Context

CivicPulse sends complaint content to a hosted LLM (Groq) for triage. Citizens
write free text, so complaint text and location can contain personal
information such as names, addresses, and phone numbers. The system must
decide what leaves our infrastructure, to whom, and under what terms.

## Decision

1. **Data sent to the provider:** only the complaint `text` and `location`,
   because both are needed for classification. `reporter_contact` is never
   sent to the provider.
2. **Untrusted input:** complaint text is treated as data, not instructions.
   It is delimited in the prompt, and the validated `TriageResult` is the
   output boundary. Anything outside the schema is rejected.
3. **Secrets:** the API key comes only from environment variables or
   deployment secrets and is never logged or committed.
4. **Zero Data Retention:** Inference APIs ZDR is **enabled** in the Groq
   Console (Data Controls) for this organization. <!-- CHANGE THIS LINE if you
   did not enable it: "Inference APIs ZDR is NOT enabled; see Consequences." -->
5. **No redaction (yet):** phone numbers and emails typed into the complaint
   body are not scrubbed before sending. Regex-based redaction before the
   provider call is a possible future improvement and is not implemented.

## Provider terms relied on

Verified 2026-09-28 against Groq's data documentation
(console.groq.com/docs/your-data), Groq's Services Agreement, and the Data
Controls page in our own Console:

- **Training:** the Services Agreement does not permit Groq to use Inputs or
  Outputs for training or fine-tuning any models without customer permission.
- **Retention:** Groq's documentation states inference requests are not
  retained by default, with temporary logging only for reliability
  troubleshooting or abuse investigation, kept up to 30 days unless law
  requires longer. The Console's Inference APIs ZDR setting describes the
  30-day period as storage "strictly for purposes of maintaining system
  reliability and compliance" that enabling ZDR opts out of. The wording
  differs slightly from the docs, so we enable ZDR and rely on the more
  conservative reading.
- **Geography:** processing is in the United States and no regional endpoint
  is offered (per third-party review; not confirmed in Groq's docs).
- **Terms can change:** this ADR must be re-checked before any production use.

## Consequences

- With ZDR enabled, Groq does not store inputs or outputs for reliability or
  abuse monitoring, which narrows the exposure of any PII in complaint text.
  Data is still transmitted to and processed by Groq in the United States.
- Because free-text fields can contain PII we do not control, a real
  deployment would additionally need a data processing agreement, review
  against applicable privacy law, and a decision on redaction.
- This is acceptable for the course project because the seeded data is
  synthetic and no real citizen data is processed.
- If ZDR is ever disabled, up to 30 days of reliability/abuse-monitoring
  storage at Groq applies, and this ADR must be updated.
- The provider interface (ADR-0001) means we can switch to a fully offline
  provider (Ollama or rules-only) if these terms become unacceptable.