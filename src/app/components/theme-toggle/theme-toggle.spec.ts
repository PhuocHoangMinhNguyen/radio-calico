import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ThemeToggle } from './theme-toggle';
import { ThemeService } from '../../services/theme.service';

describe('ThemeToggle', () => {
  let component: ThemeToggle;
  let mockThemeService: any;

  beforeEach(() => {
    // Mock ThemeService
    mockThemeService = {
      theme: signal('light' as 'light' | 'dark'),
      toggle: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ThemeToggle,
        { provide: ThemeService, useValue: mockThemeService },
      ],
    });

    component = TestBed.inject(ThemeToggle);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose theme signal from ThemeService', () => {
    expect(component.theme).toBe(mockThemeService.theme);
  });

  it('should compute isDark as false when theme is light', () => {
    mockThemeService.theme.set('light');
    expect(component.isDark()).toBe(false);
  });

  it('should compute isDark as true when theme is dark', () => {
    mockThemeService.theme.set('dark');
    expect(component.isDark()).toBe(true);
  });

  it('should call ThemeService.toggle when toggle is called', () => {
    component.toggle();

    expect(mockThemeService.toggle).toHaveBeenCalled();
  });

  it('should reflect theme changes', () => {
    mockThemeService.theme.set('light');
    expect(component.theme()).toBe('light');
    expect(component.isDark()).toBe(false);

    mockThemeService.theme.set('dark');
    expect(component.theme()).toBe('dark');
    expect(component.isDark()).toBe(true);
  });

  it('should toggle multiple times', () => {
    component.toggle();
    component.toggle();
    component.toggle();

    expect(mockThemeService.toggle).toHaveBeenCalledTimes(3);
  });
});
