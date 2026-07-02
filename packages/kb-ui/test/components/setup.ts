import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom's <dialog> support is incomplete; toggle the `open` attribute so
// modal content is treated as visible in queries and assertions.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
}

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
);

afterEach(() => {
  cleanup();
});
