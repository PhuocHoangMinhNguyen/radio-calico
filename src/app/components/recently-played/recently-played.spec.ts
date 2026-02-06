import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RecentlyPlayed } from './recently-played';
import { HlsPlayerService } from '../../services/hls-player.service';

describe('RecentlyPlayed', () => {
  let component: RecentlyPlayed;
  let mockHlsService: any;

  beforeEach(() => {
    // Mock HlsPlayerService
    mockHlsService = {
      recentlyPlayed: signal([
        { title: 'Song 1', artist: 'Artist 1', duration: 180 },
        { title: 'Song 2', artist: 'Artist 2', duration: 200 },
      ]),
    };

    TestBed.configureTestingModule({
      providers: [
        RecentlyPlayed,
        { provide: HlsPlayerService, useValue: mockHlsService },
      ],
    });

    component = TestBed.inject(RecentlyPlayed);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose recentlyPlayed signal from HlsPlayerService', () => {
    expect(component.recentlyPlayed).toBe(mockHlsService.recentlyPlayed);
  });

  it('should reflect changes in recentlyPlayed signal', () => {
    const newTracks = [
      { title: 'Song 3', artist: 'Artist 3', duration: 220 },
      { title: 'Song 4', artist: 'Artist 4', duration: 240 },
    ];
    mockHlsService.recentlyPlayed.set(newTracks);

    expect(component.recentlyPlayed()).toEqual(newTracks);
  });
});
