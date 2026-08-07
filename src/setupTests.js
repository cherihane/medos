// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jest-environment-jsdom n'expose pas structuredClone (disponible nativement
// dans Node >=17 mais pas recopié sur le global jsdom) — requis par
// fake-indexeddb pour cloner les valeurs stockées.
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

// jsdom ne fournit pas IndexedDB — nécessaire pour tester src/offline/
// (moteur hors-ligne) sans navigateur réel.
import 'fake-indexeddb/auto';
