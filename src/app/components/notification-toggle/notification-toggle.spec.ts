import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NotificationToggle } from './notification-toggle';
import { NotificationService } from '../../services/notification.service';

describe('NotificationToggle', () => {
  let component: NotificationToggle;
  let mockNotificationService: any;

  beforeEach(() => {
    // Mock NotificationService
    mockNotificationService = {
      permission: signal('default' as NotificationPermission),
      isEnabled: signal(false),
      isSupported: signal(true),
      requestPermission: vi.fn().mockResolvedValue(undefined),
      toggleEnabled: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationToggle,
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    });

    component = TestBed.inject(NotificationToggle);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose notification signals from NotificationService', () => {
    expect(component.permission).toBe(mockNotificationService.permission);
    expect(component.isEnabled).toBe(mockNotificationService.isEnabled);
    expect(component.isSupported).toBe(mockNotificationService.isSupported);
  });

  it('should call requestPermission when onRequestPermission is called', async () => {
    await component.onRequestPermission();

    expect(mockNotificationService.requestPermission).toHaveBeenCalled();
  });

  it('should call toggleEnabled when onToggle is called', () => {
    component.onToggle();

    expect(mockNotificationService.toggleEnabled).toHaveBeenCalled();
  });

  it('should handle permission changes', () => {
    mockNotificationService.permission.set('granted');
    expect(component.permission()).toBe('granted');

    mockNotificationService.permission.set('denied');
    expect(component.permission()).toBe('denied');
  });

  it('should handle enabled state changes', () => {
    mockNotificationService.isEnabled.set(true);
    expect(component.isEnabled()).toBe(true);

    mockNotificationService.isEnabled.set(false);
    expect(component.isEnabled()).toBe(false);
  });
});
