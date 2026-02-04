import { Injectable, inject, DOCUMENT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { TrackInfo } from '../models/track-info';

const DEFAULT_TITLE = 'Radio Calico - Lossless Internet Radio';
const DEFAULT_DESCRIPTION = 'Stream high-quality lossless music at 48kHz / 24-bit FLAC quality.';
const SITE_URL = 'https://radio-calico.app';
const DEFAULT_IMAGE = `${SITE_URL}/icons/icon-512.png`;

@Injectable({
  providedIn: 'root',
})
export class MetaService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);

  private jsonLdScript: HTMLScriptElement | null = null;

  constructor() {
    this.initializeJsonLd();
  }

  /**
   * Update meta tags when track changes
   */
  updateForTrack(track: TrackInfo | null, coverUrl: string | null): void {
    if (track) {
      const trackTitle = `${track.title} by ${track.artist} | Radio Calico`;
      const trackDescription = `Now playing: "${track.title}" by ${track.artist}. Stream lossless music at 48kHz / 24-bit quality.`;

      this.title.setTitle(trackTitle);

      // Open Graph
      this.meta.updateTag({ property: 'og:title', content: trackTitle });
      this.meta.updateTag({ property: 'og:description', content: trackDescription });
      if (coverUrl) {
        this.meta.updateTag({ property: 'og:image', content: coverUrl });
      }

      // Twitter
      this.meta.updateTag({ property: 'twitter:title', content: trackTitle });
      this.meta.updateTag({ property: 'twitter:description', content: trackDescription });
      if (coverUrl) {
        this.meta.updateTag({ property: 'twitter:image', content: coverUrl });
      }

      // Standard meta
      this.meta.updateTag({ name: 'description', content: trackDescription });

      // Update JSON-LD with current track
      this.updateJsonLd(track, coverUrl);
    } else {
      this.resetToDefaults();
    }
  }

  /**
   * Reset meta tags to defaults
   */
  resetToDefaults(): void {
    this.title.setTitle(DEFAULT_TITLE);
    this.meta.updateTag({ property: 'og:title', content: DEFAULT_TITLE });
    this.meta.updateTag({ property: 'og:description', content: DEFAULT_DESCRIPTION });
    this.meta.updateTag({ property: 'og:image', content: DEFAULT_IMAGE });
    this.meta.updateTag({ property: 'twitter:title', content: DEFAULT_TITLE });
    this.meta.updateTag({ property: 'twitter:description', content: DEFAULT_DESCRIPTION });
    this.meta.updateTag({ property: 'twitter:image', content: DEFAULT_IMAGE });
    this.meta.updateTag({ name: 'description', content: DEFAULT_DESCRIPTION });
    this.updateJsonLd(null, null);
  }

  /**
   * Initialize JSON-LD structured data script
   */
  private initializeJsonLd(): void {
    this.jsonLdScript = this.document.createElement('script');
    this.jsonLdScript.type = 'application/ld+json';
    this.document.head.appendChild(this.jsonLdScript);
    this.updateJsonLd(null, null);
  }

  /**
   * Update JSON-LD structured data
   */
  private updateJsonLd(track: TrackInfo | null, coverUrl: string | null): void {
    if (!this.jsonLdScript) return;

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'RadioStation',
      name: 'Radio Calico',
      description: DEFAULT_DESCRIPTION,
      url: SITE_URL,
      logo: DEFAULT_IMAGE,
      broadcastDisplayName: 'Radio Calico',
      genre: 'Various',
      areaServed: {
        '@type': 'Place',
        name: 'Worldwide',
      },
    };

    // Add current track as MusicRecording if available
    if (track) {
      jsonLd['track'] = {
        '@type': 'MusicRecording',
        name: track.title,
        byArtist: {
          '@type': 'MusicGroup',
          name: track.artist,
        },
        ...(coverUrl && { image: coverUrl }),
      };
    }

    this.jsonLdScript.textContent = JSON.stringify(jsonLd);
  }
}
