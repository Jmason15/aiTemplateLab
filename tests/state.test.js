import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../main/js/state.js';

// Reset state before each test so tests are independent.
beforeEach(() => {
    state.setPrompts([]);
    state.setCurrentPromptId(null);
    state.setCurrentTemplateGroup('Default');
    state.resetCounters();
});

describe('StateManager — getters reflect setters', () => {
    it('setPrompts updates prompts getter', () => {
        const prompts = [{ id: 'a', name: 'A', inputs: [], constraints: [], outputs: [], success: [] }];
        state.setPrompts(prompts);
        expect(state.prompts).toBe(prompts);
    });

    it('setCurrentPromptId updates currentPromptId getter', () => {
        state.setCurrentPromptId('my-id');
        expect(state.currentPromptId).toBe('my-id');
    });

    it('setCurrentPromptId accepts null', () => {
        state.setCurrentPromptId('something');
        state.setCurrentPromptId(null);
        expect(state.currentPromptId).toBeNull();
    });

    it('setCurrentTemplateGroup updates currentTemplateGroup getter', () => {
        state.setCurrentTemplateGroup('Work Templates');
        expect(state.currentTemplateGroup).toBe('Work Templates');
    });
});

describe('StateManager — counters', () => {
    it('resetCounters sets all counters to 0', () => {
        state.nextInputCounter();
        state.nextConstraintCounter();
        state.resetCounters();
        expect(state.inputCounter).toBe(0);
        expect(state.constraintCounter).toBe(0);
        expect(state.outputCounter).toBe(0);
        expect(state.successCounter).toBe(0);
    });

    it('nextInputCounter increments and returns new value', () => {
        expect(state.nextInputCounter()).toBe(1);
        expect(state.nextInputCounter()).toBe(2);
        expect(state.inputCounter).toBe(2);
    });

    it('nextConstraintCounter increments independently', () => {
        state.nextInputCounter();
        expect(state.nextConstraintCounter()).toBe(1);
        expect(state.inputCounter).toBe(1);
        expect(state.constraintCounter).toBe(1);
    });

    it('nextOutputCounter increments independently', () => {
        expect(state.nextOutputCounter()).toBe(1);
        expect(state.outputCounter).toBe(1);
    });

    it('nextSuccessCounter increments independently', () => {
        expect(state.nextSuccessCounter()).toBe(1);
        expect(state.successCounter).toBe(1);
    });
});

describe('StateManager — window.* mirrors', () => {
    it('setPrompts syncs window.prompts', () => {
        const p = [];
        state.setPrompts(p);
        expect(window.prompts).toBe(p);
    });

    it('setCurrentPromptId syncs window.currentPromptId', () => {
        state.setCurrentPromptId('abc');
        expect(window.currentPromptId).toBe('abc');
    });

    it('nextInputCounter syncs window.inputCounter', () => {
        state.nextInputCounter();
        expect(window.inputCounter).toBe(1);
    });

    it('resetCounters syncs all window counter mirrors', () => {
        state.nextInputCounter();
        state.nextConstraintCounter();
        state.resetCounters();
        expect(window.inputCounter).toBe(0);
        expect(window.constraintCounter).toBe(0);
        expect(window.outputCounter).toBe(0);
        expect(window.successCounter).toBe(0);
    });
});

describe('StateManager — environment', () => {
    it('environment returns the same reference on each access', () => {
        expect(state.environment).toBe(state.environment);
    });

    it('property mutations on environment are reflected immediately', () => {
        state.environment.templateGroups = { MyGroup: [] };
        expect(state.environment.templateGroups.MyGroup).toEqual([]);
    });
});
