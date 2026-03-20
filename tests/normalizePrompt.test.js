import { describe, it, expect } from 'vitest';
import { normalizePrompt } from '../main/js/state.js';
import { slugify } from '../main/js/utils.js';

describe('normalizePrompt', () => {
    it('leaves string constraints and success arrays unchanged', () => {
        const prompt = {
            constraints: ['rule 1', 'rule 2'],
            success: ['criterion 1'],
        };
        normalizePrompt(prompt);
        expect(prompt.constraints).toEqual(['rule 1', 'rule 2']);
        expect(prompt.success).toEqual(['criterion 1']);
    });

    it('converts legacy object constraints to strings using .rule', () => {
        const prompt = {
            constraints: [{ rule: 'must be concise' }, 'plain string'],
            success: [],
        };
        normalizePrompt(prompt);
        expect(prompt.constraints).toEqual(['must be concise', 'plain string']);
    });

    it('converts legacy object success entries to strings using .criterion', () => {
        const prompt = {
            constraints: [],
            success: [{ criterion: 'response is under 200 words' }],
        };
        normalizePrompt(prompt);
        expect(prompt.success).toEqual(['response is under 200 words']);
    });

    it('replaces missing constraints with an empty array', () => {
        const prompt = { success: [] };
        normalizePrompt(prompt);
        expect(prompt.constraints).toEqual([]);
    });

    it('replaces missing success with an empty array', () => {
        const prompt = { constraints: [] };
        normalizePrompt(prompt);
        expect(prompt.success).toEqual([]);
    });

    it('returns the same prompt object', () => {
        const prompt = { constraints: [], success: [] };
        const result = normalizePrompt(prompt);
        expect(result).toBe(prompt);
    });

    it('falls back to empty string for objects with no recognised key', () => {
        const prompt = {
            constraints: [{ unknown: 'value' }],
            success: [{ unknown: 'value' }],
        };
        normalizePrompt(prompt);
        expect(prompt.constraints).toEqual(['']);
        expect(prompt.success).toEqual(['']);
    });
});

describe('slugify', () => {
    it('lowercases and hyphenates a normal name', () => {
        expect(slugify('My Cool Template')).toBe('my-cool-template');
    });

    it('strips special characters', () => {
        expect(slugify('Jira Story & Acceptance Criteria!')).toBe('jira-story-acceptance-criteria');
    });

    it('collapses multiple spaces and punctuation into one hyphen', () => {
        expect(slugify('Hello   ---   World')).toBe('hello-world');
    });

    it('strips leading and trailing hyphens', () => {
        expect(slugify('  !!hello!! ')).toBe('hello');
    });

    it('falls back to "untitled" for a blank or symbol-only string', () => {
        expect(slugify('')).toBe('untitled');
        expect(slugify('!!!')).toBe('untitled');
    });

    it('matches the expected IDs used in prompt JSON files', () => {
        expect(slugify('Jira Story and Acceptance Criteria Generator')).toBe('jira-story-and-acceptance-criteria-generator');
        expect(slugify('Template Builder')).toBe('template-builder');
    });
});
