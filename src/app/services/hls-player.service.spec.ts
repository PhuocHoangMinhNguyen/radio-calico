import { TestBed } from '@angular/core/testing';
import { HlsPlayerService } from './hls-player.service';

describe('HlsPlayerService', () => {
  let service: HlsPlayerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HlsPlayerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial state', () => {
    expect(service.isPlaying()).toBe(false);
    expect(service.volume()).toBe(0.8);
    expect(service.status()).toBe('initializing');
  });

  it('should set volume correctly', () => {
    service.setVolume(50);
    expect(service.volume()).toBe(0.5);
  });

  it('should clamp volume between 0 and 1', () => {
    service.setVolume(150);
    expect(service.volume()).toBe(1);

    service.setVolume(-10);
    expect(service.volume()).toBe(0);
  });

  it('should compute status class correctly', () => {
    expect(service.statusClass()).toBe('');
  });
});
