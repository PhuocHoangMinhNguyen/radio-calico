import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { MetaService } from './meta.service';

describe('MetaService', () => {
  let service: MetaService;
  let mockMeta: any;
  let mockTitle: any;
  let mockDocument: any;
  let mockScript: any;

  beforeEach(() => {
    // Mock script element
    mockScript = {
      type: '',
      textContent: '',
    };

    // Mock document
    mockDocument = {
      createElement: vi.fn().mockReturnValue(mockScript),
      head: {
        appendChild: vi.fn(),
      },
    };

    // Mock Meta service
    mockMeta = {
      updateTag: vi.fn(),
    };

    // Mock Title service
    mockTitle = {
      setTitle: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        MetaService,
        { provide: Meta, useValue: mockMeta },
        { provide: Title, useValue: mockTitle },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    });

    service = TestBed.inject(MetaService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize JSON-LD script on creation', () => {
    expect(mockDocument.createElement).toHaveBeenCalledWith('script');
    expect(mockScript.type).toBe('application/ld+json');
    expect(mockDocument.head.appendChild).toHaveBeenCalledWith(mockScript);
  });

  describe('updateForTrack', () => {
    it('should update title and meta tags for track', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      const coverUrl = 'https://example.com/cover.jpg';

      service.updateForTrack(track, coverUrl);

      expect(mockTitle.setTitle).toHaveBeenCalledWith('Test Song by Test Artist | Radio Calico');
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        property: 'og:title',
        content: 'Test Song by Test Artist | Radio Calico',
      });
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        property: 'og:description',
        content:
          'Now playing: "Test Song" by Test Artist. Stream lossless music at 48kHz / 24-bit quality.',
      });
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        property: 'og:image',
        content: coverUrl,
      });
    });

    it('should update Twitter meta tags', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      const coverUrl = 'https://example.com/cover.jpg';

      service.updateForTrack(track, coverUrl);

      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        name: 'twitter:title',
        content: 'Test Song by Test Artist | Radio Calico',
      });
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        name: 'twitter:description',
        content:
          'Now playing: "Test Song" by Test Artist. Stream lossless music at 48kHz / 24-bit quality.',
      });
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        name: 'twitter:image',
        content: coverUrl,
      });
    });

    it('should update standard description meta tag', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };

      service.updateForTrack(track, null);

      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        name: 'description',
        content:
          'Now playing: "Test Song" by Test Artist. Stream lossless music at 48kHz / 24-bit quality.',
      });
    });

    it('should not update image meta tags when coverUrl is null', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };

      mockMeta.updateTag.mockClear();
      service.updateForTrack(track, null);

      const imageUpdates = mockMeta.updateTag.mock.calls.filter(
        (call: any) =>
          call[0].property === 'og:image' ||
          call[0].name === 'twitter:image' ||
          call[0].content?.includes('cover.jpg')
      );

      expect(imageUpdates.length).toBe(0);
    });

    it('should update JSON-LD with track info', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      const coverUrl = 'https://example.com/cover.jpg';

      service.updateForTrack(track, coverUrl);

      const jsonLd = JSON.parse(mockScript.textContent);
      expect(jsonLd).toHaveProperty('track');
      expect(jsonLd.track).toEqual({
        '@type': 'MusicRecording',
        name: 'Test Song',
        byArtist: {
          '@type': 'MusicGroup',
          name: 'Test Artist',
        },
        image: coverUrl,
      });
    });

    it('should reset to defaults when track is null', () => {
      service.updateForTrack(null, null);

      expect(mockTitle.setTitle).toHaveBeenCalledWith('Radio Calico - Lossless Internet Radio');
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        property: 'og:title',
        content: 'Radio Calico - Lossless Internet Radio',
      });
    });
  });

  describe('resetToDefaults', () => {
    it('should reset title to default', () => {
      service.resetToDefaults();

      expect(mockTitle.setTitle).toHaveBeenCalledWith('Radio Calico - Lossless Internet Radio');
    });

    it('should reset Open Graph tags', () => {
      service.resetToDefaults();

      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        property: 'og:title',
        content: 'Radio Calico - Lossless Internet Radio',
      });
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        property: 'og:description',
        content: 'Stream high-quality lossless music at 48kHz / 24-bit FLAC quality.',
      });
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        property: 'og:image',
        content: 'https://radio-calico.app/icons/icon-512.png',
      });
    });

    it('should reset Twitter tags', () => {
      service.resetToDefaults();

      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        name: 'twitter:title',
        content: 'Radio Calico - Lossless Internet Radio',
      });
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        name: 'twitter:description',
        content: 'Stream high-quality lossless music at 48kHz / 24-bit FLAC quality.',
      });
      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        name: 'twitter:image',
        content: 'https://radio-calico.app/icons/icon-512.png',
      });
    });

    it('should reset description tag', () => {
      service.resetToDefaults();

      expect(mockMeta.updateTag).toHaveBeenCalledWith({
        name: 'description',
        content: 'Stream high-quality lossless music at 48kHz / 24-bit FLAC quality.',
      });
    });

    it('should reset JSON-LD to base RadioStation structure', () => {
      service.resetToDefaults();

      const jsonLd = JSON.parse(mockScript.textContent);
      expect(jsonLd['@type']).toBe('RadioStation');
      expect(jsonLd.name).toBe('Radio Calico');
      expect(jsonLd).not.toHaveProperty('track');
    });
  });

  describe('JSON-LD structured data', () => {
    it('should include RadioStation base structure', () => {
      const jsonLd = JSON.parse(mockScript.textContent);

      expect(jsonLd).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'RadioStation',
        name: 'Radio Calico',
        url: 'https://radio-calico.app',
        broadcastDisplayName: 'Radio Calico',
        genre: 'Various',
      });
    });

    it('should include areaServed as Worldwide', () => {
      const jsonLd = JSON.parse(mockScript.textContent);

      expect(jsonLd.areaServed).toEqual({
        '@type': 'Place',
        name: 'Worldwide',
      });
    });

    it('should not include image in track when coverUrl is null', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      service.updateForTrack(track, null);

      const jsonLd = JSON.parse(mockScript.textContent);
      expect(jsonLd.track).not.toHaveProperty('image');
    });
  });
});
