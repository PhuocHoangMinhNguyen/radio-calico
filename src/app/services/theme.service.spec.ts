import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ThemeService } from './theme.service';
import { PreferencesService } from './preferences.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockPreferencesService: any;

  beforeEach(() => {
    // Mock PreferencesService
    mockPreferencesService = {
      theme: signal('dark' as 'dark' | 'light'),
      setTheme: (theme: 'dark' | 'light') => {
        mockPreferencesService.theme.set(theme);
      },
    };

    TestBed.configureTestingModule({
      providers: [ThemeService, { provide: PreferencesService, useValue: mockPreferencesService }],
    });

    service = TestBed.inject(ThemeService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should expose theme signal from PreferencesService', () => {
    expect(service.theme).toBe(mockPreferencesService.theme);
  });

  it('should apply theme on initialization', async () => {
    mockPreferencesService.theme.set('dark');

    // Create new service instance to trigger constructor effect
    const newService = TestBed.inject(ThemeService);

    // Allow effect to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  describe('setTheme', () => {
    it('should set dark theme', async () => {
      service.setTheme('dark');

      // Allow effect to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockPreferencesService.theme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should set light theme', async () => {
      service.setTheme('light');

      // Allow effect to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockPreferencesService.theme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should update data-theme attribute when theme changes', async () => {
      service.setTheme('dark');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      service.setTheme('light');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('toggle', () => {
    it('should toggle from dark to light', async () => {
      mockPreferencesService.theme.set('dark');

      service.toggle();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockPreferencesService.theme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should toggle from light to dark', async () => {
      mockPreferencesService.theme.set('light');

      service.toggle();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockPreferencesService.theme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should handle multiple toggles', async () => {
      mockPreferencesService.theme.set('dark');

      service.toggle();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockPreferencesService.theme()).toBe('light');

      service.toggle();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockPreferencesService.theme()).toBe('dark');

      service.toggle();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockPreferencesService.theme()).toBe('light');
    });
  });

  describe('theme application via effect', () => {
    it('should apply theme when signal changes', async () => {
      // Change theme signal directly
      mockPreferencesService.theme.set('light');

      // Allow effect to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // Change again
      mockPreferencesService.theme.set('dark');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
