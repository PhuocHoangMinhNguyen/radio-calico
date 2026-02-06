import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferencesService } from './preferences.service';

// ---------------------------------------------------------------------------
// localStorage stub — Node's test environment lacks full Web Storage support.
// vi.stubGlobal replaces globalThis.localStorage for the entire file.
// ---------------------------------------------------------------------------
let lsStore: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem(key: string) {
    return lsStore[key] ?? null;
  },
  setItem(key: string, value: string) {
    lsStore[key] = String(value);
  },
  removeItem(key: string) {
    delete lsStore[key];
  },
  clear() {
    lsStore = {};
  },
});

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(() => {
    lsStore = {};
    TestBed.configureTestingModule({ providers: [PreferencesService] });
    service = TestBed.inject(PreferencesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with default preferences when localStorage is empty', () => {
    expect(service.volume()).toBe(0.8);
    expect(service.isMuted()).toBe(false);
    expect(service.theme()).toBe('dark');
    expect(service.notificationsEnabled()).toBe(false);
  });

  it('should load preferences from localStorage on initialization', () => {
    localStorage.setItem(
      'radio-calico-preferences',
      JSON.stringify({
        volume: 0.5,
        isMuted: true,
        theme: 'light',
        notificationsEnabled: true,
      })
    );

    // Reset TestBed and create fresh service to trigger loadPreferences
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PreferencesService] });
    service = TestBed.inject(PreferencesService);

    expect(service.volume()).toBe(0.5);
    expect(service.isMuted()).toBe(true);
    expect(service.theme()).toBe('light');
    expect(service.notificationsEnabled()).toBe(true);
  });

  it('should ignore invalid volume values when loading from localStorage', () => {
    localStorage.setItem(
      'radio-calico-preferences',
      JSON.stringify({ volume: 1.5 }) // Out of range
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PreferencesService] });
    service = TestBed.inject(PreferencesService);

    expect(service.volume()).toBe(0.8); // Falls back to default
  });

  it('should ignore invalid theme values when loading from localStorage', () => {
    localStorage.setItem(
      'radio-calico-preferences',
      JSON.stringify({ theme: 'blue' }) // Invalid theme
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PreferencesService] });
    service = TestBed.inject(PreferencesService);

    expect(service.theme()).toBe('dark'); // Falls back to default
  });

  it('should handle corrupted JSON in localStorage gracefully', () => {
    localStorage.setItem('radio-calico-preferences', '{not valid json');

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PreferencesService] });
    service = TestBed.inject(PreferencesService);

    expect(service.volume()).toBe(0.8);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to load preferences from localStorage:',
      expect.any(SyntaxError)
    );

    consoleWarnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // setVolume()
  // -------------------------------------------------------------------------
  describe('setVolume', () => {
    it('sets volume and persists to localStorage', () => {
      service.setVolume(0.6);

      expect(service.volume()).toBe(0.6);

      const stored = JSON.parse(localStorage.getItem('radio-calico-preferences')!);
      expect(stored.volume).toBe(0.6);
    });

    it('clamps volume to 0-1 range', () => {
      service.setVolume(1.5);
      expect(service.volume()).toBe(1);

      service.setVolume(-0.2);
      expect(service.volume()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // setMuted()
  // -------------------------------------------------------------------------
  describe('setMuted', () => {
    it('sets muted state and persists to localStorage', () => {
      service.setMuted(true);

      expect(service.isMuted()).toBe(true);

      const stored = JSON.parse(localStorage.getItem('radio-calico-preferences')!);
      expect(stored.isMuted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // setTheme()
  // -------------------------------------------------------------------------
  describe('setTheme', () => {
    it('sets theme and persists to localStorage', () => {
      service.setTheme('light');

      expect(service.theme()).toBe('light');

      const stored = JSON.parse(localStorage.getItem('radio-calico-preferences')!);
      expect(stored.theme).toBe('light');
    });
  });

  // -------------------------------------------------------------------------
  // setNotificationsEnabled()
  // -------------------------------------------------------------------------
  describe('setNotificationsEnabled', () => {
    it('sets notification preference and persists to localStorage', () => {
      service.setNotificationsEnabled(true);

      expect(service.notificationsEnabled()).toBe(true);

      const stored = JSON.parse(localStorage.getItem('radio-calico-preferences')!);
      expect(stored.notificationsEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // resetToDefaults()
  // -------------------------------------------------------------------------
  describe('resetToDefaults', () => {
    it('resets all preferences to default values and persists to localStorage', () => {
      // Set non-default values
      service.setVolume(0.3);
      service.setMuted(true);
      service.setTheme('light');
      service.setNotificationsEnabled(true);

      // Reset
      service.resetToDefaults();

      expect(service.volume()).toBe(0.8);
      expect(service.isMuted()).toBe(false);
      expect(service.theme()).toBe('dark');
      expect(service.notificationsEnabled()).toBe(false);

      const stored = JSON.parse(localStorage.getItem('radio-calico-preferences')!);
      expect(stored.volume).toBe(0.8);
      expect(stored.isMuted).toBe(false);
      expect(stored.theme).toBe('dark');
      expect(stored.notificationsEnabled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('logs a warning and continues when localStorage.setItem fails', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Make setItem throw an error (e.g., quota exceeded)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });

      service.setVolume(0.5);

      // Service still updates in-memory state
      expect(service.volume()).toBe(0.5);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save preferences to localStorage:',
        expect.any(DOMException)
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
