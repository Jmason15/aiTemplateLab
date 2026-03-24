import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../main/js/utils.js';

describe('escapeHtml', () => {
    it('escapes < and >', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes ampersands', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('prevents XSS injection', () => {
        expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('returns plain text unchanged', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });

    it('handles empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('handles text with no special characters', () => {
        expect(escapeHtml('Template Builder')).toBe('Template Builder');
    });
});
