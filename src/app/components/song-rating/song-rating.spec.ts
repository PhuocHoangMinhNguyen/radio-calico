import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SongRating } from './song-rating';
import { RatingService } from '../../services/rating.service';
import { HlsPlayerService } from '../../services/hls-player.service';

describe('SongRating', () => {
  let component: SongRating;
  let mockRatingService: any;
  let mockHlsService: any;

  beforeEach(() => {
    // Mock RatingService
    mockRatingService = {
      ratings: signal({ thumbsUp: 0, thumbsDown: 0 }),
      userRating: signal(null as 'up' | 'down' | null),
      fetchRatings: vi.fn(),
      submitRating: vi.fn(),
    };

    // Mock HlsPlayerService
    mockHlsService = {
      currentTrack: signal(null as any),
      hasTrackInfo: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        SongRating,
        { provide: RatingService, useValue: mockRatingService },
        { provide: HlsPlayerService, useValue: mockHlsService },
      ],
    });

    component = TestBed.inject(SongRating);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose rating signals from RatingService', () => {
    expect(component.ratings).toBe(mockRatingService.ratings);
    expect(component.userRating).toBe(mockRatingService.userRating);
  });

  it('should expose hasTrackInfo signal from HlsPlayerService', () => {
    expect(component.hasTrackInfo).toBe(mockHlsService.hasTrackInfo);
  });

  it('should fetch ratings when track changes', async () => {
    const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
    mockHlsService.currentTrack.set(track);

    // Allow effect to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRatingService.fetchRatings).toHaveBeenCalledWith('Test Song', 'Test Artist');
  });

  it('should not fetch ratings when track is null', async () => {
    mockHlsService.currentTrack.set(null);

    // Allow effect to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRatingService.fetchRatings).not.toHaveBeenCalled();
  });

  it('should submit thumbs up rating', () => {
    const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
    mockHlsService.currentTrack.set(track);

    component.onRate('up');

    expect(mockRatingService.submitRating).toHaveBeenCalledWith('Test Song', 'Test Artist', 'up');
  });

  it('should submit thumbs down rating', () => {
    const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
    mockHlsService.currentTrack.set(track);

    component.onRate('down');

    expect(mockRatingService.submitRating).toHaveBeenCalledWith(
      'Test Song',
      'Test Artist',
      'down'
    );
  });

  it('should not submit rating when track is null', () => {
    mockHlsService.currentTrack.set(null);

    component.onRate('up');

    expect(mockRatingService.submitRating).not.toHaveBeenCalled();
  });

  it('should handle multiple track changes', async () => {
    const track1 = { title: 'Song 1', artist: 'Artist 1', duration: 180 };
    const track2 = { title: 'Song 2', artist: 'Artist 2', duration: 200 };

    mockHlsService.currentTrack.set(track1);
    await new Promise((resolve) => setTimeout(resolve, 0));

    mockHlsService.currentTrack.set(track2);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRatingService.fetchRatings).toHaveBeenCalledTimes(2);
    expect(mockRatingService.fetchRatings).toHaveBeenCalledWith('Song 1', 'Artist 1');
    expect(mockRatingService.fetchRatings).toHaveBeenCalledWith('Song 2', 'Artist 2');
  });
});
