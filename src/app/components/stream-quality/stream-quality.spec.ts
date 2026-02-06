import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { StreamQualityComponent } from './stream-quality';
import { HlsPlayerService, ConnectionQuality } from '../../services/hls-player.service';

describe('StreamQualityComponent', () => {
  let component: StreamQualityComponent;
  let mockPlayerService: any;

  beforeEach(() => {
    // Mock HlsPlayerService
    mockPlayerService = {
      bufferHealth: signal(5.0),
      bitrate: signal(1536),
      connectionQuality: signal('good' as ConnectionQuality),
      isPlaying: signal(true),
    };

    TestBed.configureTestingModule({
      providers: [
        StreamQualityComponent,
        { provide: HlsPlayerService, useValue: mockPlayerService },
      ],
    });

    component = TestBed.inject(StreamQualityComponent);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose bufferHealth signal from HlsPlayerService', () => {
    expect(component.bufferHealth).toBe(mockPlayerService.bufferHealth);
  });

  it('should expose bitrate signal from HlsPlayerService', () => {
    expect(component.bitrate).toBe(mockPlayerService.bitrate);
  });

  it('should expose connectionQuality signal from HlsPlayerService', () => {
    expect(component.connectionQuality).toBe(mockPlayerService.connectionQuality);
  });

  it('should expose isPlaying signal from HlsPlayerService', () => {
    expect(component.isPlaying).toBe(mockPlayerService.isPlaying);
  });

  describe('qualityLabel computed signal', () => {
    it('should return "Good" for good quality', () => {
      mockPlayerService.connectionQuality.set('good');
      expect(component.qualityLabel()).toBe('Good');
    });

    it('should return "Fair" for fair quality', () => {
      mockPlayerService.connectionQuality.set('fair');
      expect(component.qualityLabel()).toBe('Fair');
    });

    it('should return "Poor" for poor quality', () => {
      mockPlayerService.connectionQuality.set('poor');
      expect(component.qualityLabel()).toBe('Poor');
    });
  });

  describe('qualityIcon computed signal', () => {
    it('should return full signal icon for good quality', () => {
      mockPlayerService.connectionQuality.set('good');
      expect(component.qualityIcon()).toBe('signal_cellular_alt');
    });

    it('should return 2-bar signal icon for fair quality', () => {
      mockPlayerService.connectionQuality.set('fair');
      expect(component.qualityIcon()).toBe('signal_cellular_alt_2_bar');
    });

    it('should return 1-bar signal icon for poor quality', () => {
      mockPlayerService.connectionQuality.set('poor');
      expect(component.qualityIcon()).toBe('signal_cellular_alt_1_bar');
    });
  });

  describe('formattedBitrate computed signal', () => {
    it('should format bitrate in kbps when less than 1000', () => {
      mockPlayerService.bitrate.set(768);
      expect(component.formattedBitrate()).toBe('768 kbps');
    });

    it('should format bitrate in Mbps when >= 1000', () => {
      mockPlayerService.bitrate.set(1536);
      expect(component.formattedBitrate()).toBe('1.5 Mbps');
    });

    it('should round Mbps to one decimal place', () => {
      mockPlayerService.bitrate.set(2345);
      expect(component.formattedBitrate()).toBe('2.3 Mbps');
    });
  });

  describe('formattedBuffer computed signal', () => {
    it('should format buffer health with one decimal place', () => {
      mockPlayerService.bufferHealth.set(5.0);
      expect(component.formattedBuffer()).toBe('5.0s');
    });

    it('should round buffer health to one decimal place', () => {
      mockPlayerService.bufferHealth.set(3.456);
      expect(component.formattedBuffer()).toBe('3.5s');
    });

    it('should handle zero buffer health', () => {
      mockPlayerService.bufferHealth.set(0);
      expect(component.formattedBuffer()).toBe('0.0s');
    });
  });
});
