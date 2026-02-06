import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SleepTimerButton } from './sleep-timer-button';
import { SleepTimerService, SLEEP_TIMER_OPTIONS } from '../../services/sleep-timer.service';

describe('SleepTimerButton', () => {
  let component: SleepTimerButton;
  let mockSleepTimerService: any;

  beforeEach(() => {
    // Mock SleepTimerService
    mockSleepTimerService = {
      isActive: signal(false),
      formattedTime: signal(''),
      selectedDuration: signal(null as number | null),
      start: vi.fn(),
      cancel: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SleepTimerButton,
        { provide: SleepTimerService, useValue: mockSleepTimerService },
      ],
    });

    component = TestBed.inject(SleepTimerButton);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose SLEEP_TIMER_OPTIONS', () => {
    expect(component.options).toBe(SLEEP_TIMER_OPTIONS);
  });

  it('should expose SleepTimerService signals', () => {
    expect(component.isActive).toBe(mockSleepTimerService.isActive);
    expect(component.formattedTime).toBe(mockSleepTimerService.formattedTime);
    expect(component.selectedDuration).toBe(mockSleepTimerService.selectedDuration);
  });

  it('should initialize with menu closed', () => {
    expect(component.isMenuOpen()).toBe(false);
  });

  describe('toggleMenu', () => {
    it('should open menu when closed', () => {
      component.isMenuOpen.set(false);

      component.toggleMenu();

      expect(component.isMenuOpen()).toBe(true);
    });

    it('should close menu when open', () => {
      component.isMenuOpen.set(true);

      component.toggleMenu();

      expect(component.isMenuOpen()).toBe(false);
    });
  });

  describe('closeMenu', () => {
    it('should close menu', () => {
      component.isMenuOpen.set(true);

      component.closeMenu();

      expect(component.isMenuOpen()).toBe(false);
    });

    it('should do nothing if menu already closed', () => {
      component.isMenuOpen.set(false);

      component.closeMenu();

      expect(component.isMenuOpen()).toBe(false);
    });
  });

  describe('selectDuration', () => {
    it('should start timer with 15 minutes', () => {
      component.isMenuOpen.set(true);

      component.selectDuration(15);

      expect(mockSleepTimerService.start).toHaveBeenCalledWith(15);
      expect(component.isMenuOpen()).toBe(false);
    });

    it('should start timer with 30 minutes', () => {
      component.isMenuOpen.set(true);

      component.selectDuration(30);

      expect(mockSleepTimerService.start).toHaveBeenCalledWith(30);
      expect(component.isMenuOpen()).toBe(false);
    });

    it('should start timer with 60 minutes', () => {
      component.isMenuOpen.set(true);

      component.selectDuration(60);

      expect(mockSleepTimerService.start).toHaveBeenCalledWith(60);
      expect(component.isMenuOpen()).toBe(false);
    });

    it('should close menu after selecting duration', () => {
      component.isMenuOpen.set(true);

      component.selectDuration(30);

      expect(component.isMenuOpen()).toBe(false);
    });
  });

  describe('cancelTimer', () => {
    it('should cancel active timer', () => {
      mockSleepTimerService.isActive.set(true);
      component.isMenuOpen.set(true);

      component.cancelTimer();

      expect(mockSleepTimerService.cancel).toHaveBeenCalled();
      expect(component.isMenuOpen()).toBe(false);
    });

    it('should close menu after canceling', () => {
      component.isMenuOpen.set(true);

      component.cancelTimer();

      expect(component.isMenuOpen()).toBe(false);
    });
  });

  describe('onMenuKeydown', () => {
    it('should close menu on Escape key', () => {
      component.isMenuOpen.set(true);
      const event = new KeyboardEvent('keydown', { key: 'Escape' });

      component.onMenuKeydown(event);

      expect(component.isMenuOpen()).toBe(false);
    });

    it('should not close menu on other keys', () => {
      component.isMenuOpen.set(true);
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      component.onMenuKeydown(event);

      expect(component.isMenuOpen()).toBe(true);
    });
  });
});
