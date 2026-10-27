import { redactPersonalData } from './redaction.js';

describe('redactPersonalData', () => {
    it('removes emails, phones, CPF/CNPJ, cards and tokens, counting each kind', () => {
        const { text, redactions } = redactPersonalData(
            'Tutor ana.souza@gmail.com, cel (61) 99876-5432 / +55 11 3333-4444, CPF 123.456.789-09, ' +
                'clínica 12.345.678/0001-90, cartão 4111 1111 1111 1111, token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcdefghijk ghp_abcdefghijklmnopqrstuvwxyz',
        );
        expect(text).toBe(
            'Tutor [EMAIL], cel [PHONE] / [PHONE], CPF [CPF], clínica [CNPJ], cartão [CARD], token [TOKEN] [TOKEN]',
        );
        expect(redactions).toEqual({ EMAIL: 1, PHONE: 2, CPF: 1, CNPJ: 1, CARD: 1, TOKEN: 2 });
    });

    it('keeps measurements, dates, versions and ids intact', () => {
        const input = 'TPA 24.5° then 6.3 mm on 2026-10-27, app v1.12.3, case 6f1c2b84-1f5e-4c2a-9d3e-2b7a1c9e0f11, 800 × 600 px';
        expect(redactPersonalData(input)).toEqual({ text: input, redactions: {} });
    });
});
