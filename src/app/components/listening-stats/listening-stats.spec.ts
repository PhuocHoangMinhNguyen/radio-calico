import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ListeningStats } from './listening-stats';
import { StatsService } from '../../services/stats.service';

describe('ListeningStats', () => {
  let component: ListeningStats;
  let mockStatsService: any;

  beforeEach(() => {
    // Mock StatsService
    mockStatsService = {
      displayMessage: signal('5 minutes'),
      totalSeconds: signal(300),
    };

    TestBed.configureTestingModule({
      providers: [
        ListeningStats,
        { provide: StatsService, useValue: mockStatsService },
      ],
    });

    component = TestBed.inject(ListeningStats);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose displayMessage signal from StatsService', () => {
    expect(component.displayMessage).toBe(mockStatsService.displayMessage);
  });

  it('should expose totalSeconds signal from StatsService', () => {
    expect(component.totalSeconds).toBe(mockStatsService.totalSeconds);
  });

  it('should reflect changes in displayMessage', () => {
    mockStatsService.displayMessage.set('1 hour 30 minutes');
    expect(component.displayMessage()).toBe('1 hour 30 minutes');
  });

  it('should reflect changes in totalSeconds', () => {
    mockStatsService.totalSeconds.set(5400);
    expect(component.totalSeconds()).toBe(5400);
  });
});
