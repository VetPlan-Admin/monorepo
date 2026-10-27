/**
 * Removes personal and secret data from support messages before they leave the server
 * (LLM providers, GitHub issues, logs). Defence in depth: the chosen providers don't train on
 * inputs, but text also flows through Telegram and GitHub. Pet owners' names and phone numbers
 * are personal data under LGPD/GDPR; animals' clinical data stays confidential to the clinic.
 *
 * Free-text names can't be detected reliably, so the bot also asks users not to send them.
 */
const RULES: { kind: string; pattern: RegExp }[] = [
    { kind: 'EMAIL', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    // Bearer/API tokens and JWTs pasted from dev tools
    { kind: 'TOKEN', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
    { kind: 'TOKEN', pattern: /\b(?:sk|pk|ghp|gho|github_pat|xox[abpr])[-_][A-Za-z0-9_-]{16,}\b/g },
    // Brazilian CPF (000.000.000-00) and CNPJ (00.000.000/0000-00), formatted or not
    { kind: 'CNPJ', pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g },
    { kind: 'CPF', pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g },
    // Card-like numbers: 13–19 digits with optional spaces/dashes
    { kind: 'CARD', pattern: /\b(?:\d[ -]?){12,18}\d\b/g },
    // Phone numbers: +55 (61) 99999-9999, (61) 3333-4444, +1 415 555 0100, 61999999999
    { kind: 'PHONE', pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,3}\)\s?|\b\d{2,3}[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g },
];

export interface RedactionResult {
    text: string;
    /** Count per kind, e.g. { EMAIL: 1, PHONE: 2 }. */
    redactions: Record<string, number>;
}

export function redactPersonalData(input: string): RedactionResult {
    const redactions: Record<string, number> = {};
    let text = input;
    for (const { kind, pattern } of RULES) {
        text = text.replace(pattern, () => {
            redactions[kind] = (redactions[kind] ?? 0) + 1;
            return `[${kind}]`;
        });
    }
    return { text, redactions };
}
