import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NotificationService } from './notification.service';
import { PreferencesService } from './preferences.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockPreferencesService: any;
  let mockNotification: any;
  let mockNotificationInstance: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock notification instance
    mockNotificationInstance = {
      close: vi.fn(),
      onclick: null,
    };

    // Mock Notification constructor
    mockNotification = vi.fn().mockReturnValue(mockNotificationInstance);
    mockNotification.permission = 'default';
    mockNotification.requestPermission = vi.fn().mockResolvedValue('granted');

    // Replace global Notification
    (globalThis as any).Notification = mockNotification;

    // Mock PreferencesService
    mockPreferencesService = {
      notificationsEnabled: signal(false),
      setNotificationsEnabled: vi.fn((enabled: boolean) => {
        mockPreferencesService.notificationsEnabled.set(enabled);
      }),
    };

    // Mock document.hidden
    Object.defineProperty(document, 'hidden', {
      writable: true,
      configurable: true,
      value: false,
    });

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: PreferencesService, useValue: mockPreferencesService },
      ],
    });

    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('isSupported', () => {
    it('should return true when Notification API exists', () => {
      expect(service.isSupported).toBe(true);
    });

    it('should return false when Notification API does not exist', () => {
      delete (globalThis as any).Notification;
      const newService = TestBed.inject(NotificationService);
      expect(newService.isSupported).toBe(false);
    });
  });

  describe('canNotify', () => {
    it('should return true when supported, granted, and enabled', () => {
      mockNotification.permission = 'granted';
      service['_permission'].set('granted');
      service['_isEnabled'].set(true);

      expect(service.canNotify).toBe(true);
    });

    it('should return false when permission not granted', () => {
      service['_permission'].set('default');
      service['_isEnabled'].set(true);

      expect(service.canNotify).toBe(false);
    });

    it('should return false when not enabled', () => {
      service['_permission'].set('granted');
      service['_isEnabled'].set(false);

      expect(service.canNotify).toBe(false);
    });

    it('should return false when not supported', () => {
      delete (globalThis as any).Notification;
      const newService = TestBed.inject(NotificationService);
      newService['_isEnabled'].set(true);

      expect(newService.canNotify).toBe(false);
    });
  });

  describe('requestPermission', () => {
    it('should request and return granted permission', async () => {
      mockNotification.requestPermission.mockResolvedValue('granted');

      const result = await service.requestPermission();

      expect(mockNotification.requestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
      expect(service.permission()).toBe('granted');
    });

    it('should enable notifications automatically when granted', async () => {
      mockNotification.requestPermission.mockResolvedValue('granted');

      await service.requestPermission();

      expect(mockPreferencesService.setNotificationsEnabled).toHaveBeenCalledWith(true);
      expect(service.isEnabled()).toBe(true);
    });

    it('should return denied permission', async () => {
      mockNotification.requestPermission.mockResolvedValue('denied');

      const result = await service.requestPermission();

      expect(result).toBe('denied');
      expect(service.permission()).toBe('denied');
    });

    it('should not enable notifications when denied', async () => {
      mockNotification.requestPermission.mockResolvedValue('denied');

      await service.requestPermission();

      expect(mockPreferencesService.setNotificationsEnabled).not.toHaveBeenCalled();
    });

    it('should return unsupported when Notification API not available', async () => {
      delete (globalThis as any).Notification;
      const newService = TestBed.inject(NotificationService);

      const result = await newService.requestPermission();

      expect(result).toBe('unsupported');
    });

    it('should handle request errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockNotification.requestPermission.mockRejectedValue(new Error('Permission error'));

      const result = await service.requestPermission();

      expect(result).toBe('denied');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    it('should enable notifications', () => {
      service.setEnabled(true);

      expect(service.isEnabled()).toBe(true);
      expect(mockPreferencesService.setNotificationsEnabled).toHaveBeenCalledWith(true);
    });

    it('should disable notifications', () => {
      service.setEnabled(false);

      expect(service.isEnabled()).toBe(false);
      expect(mockPreferencesService.setNotificationsEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('toggleEnabled', () => {
    it('should toggle from disabled to enabled', () => {
      service['_isEnabled'].set(false);

      service.toggleEnabled();

      expect(service.isEnabled()).toBe(true);
    });

    it('should toggle from enabled to disabled', () => {
      service['_isEnabled'].set(true);

      service.toggleEnabled();

      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('notifyTrackChange', () => {
    beforeEach(() => {
      // Set up conditions for notifications to work
      service['_permission'].set('granted');
      service['_isEnabled'].set(true);
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
    });

    it('should show notification when page is hidden and can notify', () => {
      service.notifyTrackChange('Test Song', 'Test Artist', 'https://example.com/cover.jpg');

      expect(mockNotification).toHaveBeenCalledWith('Test Song', {
        body: 'Test Artist',
        icon: 'https://example.com/cover.jpg',
        badge: '/icons/icon-192.svg',
        tag: 'track-change',
        silent: false,
      });
    });

    it('should use default icon when coverUrl is null', () => {
      service.notifyTrackChange('Test Song', 'Test Artist', null);

      expect(mockNotification).toHaveBeenCalledWith(
        'Test Song',
        expect.objectContaining({
          icon: '/icons/icon-192.svg',
        })
      );
    });

    it('should not show notification when page is visible', () => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true });

      service.notifyTrackChange('Test Song', 'Test Artist', null);

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('should not show notification when cannot notify', () => {
      service['_isEnabled'].set(false);

      service.notifyTrackChange('Test Song', 'Test Artist', null);

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('should focus window on notification click', () => {
      const mockWindowFocus = vi.fn();
      globalThis.window.focus = mockWindowFocus;

      service.notifyTrackChange('Test Song', 'Test Artist', null);

      // Simulate click
      mockNotificationInstance.onclick();

      expect(mockWindowFocus).toHaveBeenCalled();
      expect(mockNotificationInstance.close).toHaveBeenCalled();
    });

    it('should auto-close notification after 5 seconds', () => {
      service.notifyTrackChange('Test Song', 'Test Artist', null);

      expect(mockNotificationInstance.close).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(mockNotificationInstance.close).toHaveBeenCalled();
    });

    it('should handle notification creation errors', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockNotification.mockImplementation(() => {
        throw new Error('Notification failed');
      });

      service.notifyTrackChange('Test Song', 'Test Artist', null);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should use track-change tag for replacing previous notifications', () => {
      service.notifyTrackChange('Song 1', 'Artist 1', null);
      service.notifyTrackChange('Song 2', 'Artist 2', null);

      // Both calls should use same tag
      expect(mockNotification).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ tag: 'track-change' })
      );
    });
  });
});
