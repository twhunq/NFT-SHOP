import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';

async function loadFacebookGroupContext(overrides = {}) {
  const source = await fs.readFile(path.join(process.cwd(), 'js', 'facebook-group.js'), 'utf8');
  const context = {
    console,
    URL,
    DB: { getFacebookGroupUrl: async () => '', ...(overrides.DB || {}) },
    Utils: { toast: () => {}, ...(overrides.Utils || {}) },
    window: {
      open: () => ({}),
      ...(overrides.window || {}),
    },
    document: {
      getElementById: () => null,
      ...(overrides.document || {}),
    },
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.FacebookGroup = FacebookGroup;`, context);
  return context;
}

test('unit: validateUrl accepts facebook.com link and normalizes protocol', async () => {
  const { FacebookGroup } = await loadFacebookGroupContext();
  const result = FacebookGroup.validateUrl('facebook.com/groups/test-group');
  assert.equal(result.ok, true);
  assert.equal(result.normalizedUrl.startsWith('https://facebook.com/'), true);
});

test('unit: validateUrl rejects non-facebook domain', async () => {
  const { FacebookGroup } = await loadFacebookGroupContext();
  const result = FacebookGroup.validateUrl('https://example.com/group');
  assert.equal(result.ok, false);
});

test('integration: initHomeButton applies href and visibility when URL is valid', async () => {
  const button = {
    href: '',
    target: '',
    rel: '',
    hidden: true,
    _events: {},
    classList: {
      add: (name) => { if (name === 'hidden') button.hidden = true; },
      remove: (name) => { if (name === 'hidden') button.hidden = false; },
    },
    addEventListener: (event, handler) => { button._events[event] = handler; },
  };

  const { FacebookGroup } = await loadFacebookGroupContext({
    DB: {
      getFacebookGroupUrl: async () => 'https://www.facebook.com/groups/test-group',
    },
    document: {
      getElementById: (id) => (id === 'btn-facebook-group' ? button : null),
    },
  });

  await FacebookGroup.initHomeButton('btn-facebook-group');
  assert.equal(button.hidden, false);
  assert.equal(button.href.includes('facebook.com/groups/test-group'), true);
  assert.equal(button.target, '_blank');
});
