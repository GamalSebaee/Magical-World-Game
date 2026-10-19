// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BigButton, TAP_DEBOUNCE_MS } from './BigButton';
import { Bdi } from '../i18n/Bdi';

afterEach(cleanup);

describe('BigButton', () => {
  it('has an accessible name and ignores repeat taps inside the debounce window', () => {
    let now = 1000;
    const onPress = vi.fn();
    render(
      <BigButton label="Play" onPress={onPress} now={() => now}>
        ▶
      </BigButton>,
    );
    const btn = screen.getByRole('button', { name: 'Play' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    now += TAP_DEBOUNCE_MS - 1;
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
    now += 1;
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(2);
  });
});

describe('Bdi', () => {
  it('isolates embedded English inside Arabic text', () => {
    const { container } = render(
      <p dir="rtl">
        فين الـ <Bdi lang="en">Dog</Bdi>؟
      </p>,
    );
    const bdi = container.querySelector('bdi');
    expect(bdi?.getAttribute('dir')).toBe('ltr');
    expect(bdi?.getAttribute('lang')).toBe('en');
  });
});
