import { Injectable, inject, signal } from '@angular/core';
import { HlsPlayerService } from './hls-player.service';

export interface ShareData {
  title: string;
  artist: string;
  url: string;
}

/**
 * Service for sharing current track to social media and clipboard.
 * Supports Twitter/X, Facebook, native Web Share API, and clipboard copy.
 */
@Injectable({
  providedIn: 'root',
})
export class ShareService {
  private hlsService = inject(HlsPlayerService);

  // Base URL for the radio app (update for production)
  private readonly appUrl = 'https://radio-calico.app';
  private readonly appName = 'Radio Calico';

  /**
   * Check if Web Share API is available (typically on mobile).
   * Exposed as a signal for reactivity in components.
   */
  readonly canUseNativeShare = signal('share' in navigator);

  /**
   * Get current track share data.
   */
  getShareData(): ShareData | null {
    const track = this.hlsService.currentTrack();
    if (!track) return null;

    return {
      title: track.title,
      artist: track.artist,
      url: this.appUrl,
    };
  }

  /**
   * Generate share text for the current track.
   */
  private getShareText(data: ShareData): string {
    return `Listening to "${data.title}" by ${data.artist} on ${this.appName}`;
  }

  /**
   * Share using native Web Share API (mobile).
   * Returns true if successful, false if failed or unavailable.
   */
  async shareNative(): Promise<boolean> {
    const data = this.getShareData();
    if (!data || !this.canUseNativeShare()) return false;

    try {
      await navigator.share({
        title: `${data.title} - ${data.artist}`,
        text: this.getShareText(data),
        url: data.url,
      });
      return true;
    } catch (error) {
      // User cancelled or share failed
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Share failed:', error);
      }
      return false;
    }
  }

  /**
   * Share to Twitter/X.
   * Opens Twitter intent URL in a new window.
   */
  shareToTwitter(): void {
    const data = this.getShareData();
    if (!data) return;

    const text = encodeURIComponent(this.getShareText(data));
    const url = encodeURIComponent(data.url);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;

    window.open(twitterUrl, '_blank', 'width=550,height=420,noopener,noreferrer');
  }

  /**
   * Share to Facebook.
   * Opens Facebook share dialog in a new window.
   */
  shareToFacebook(): void {
    const data = this.getShareData();
    if (!data) return;

    const url = encodeURIComponent(data.url);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;

    window.open(facebookUrl, '_blank', 'width=550,height=420,noopener,noreferrer');
  }

  /**
   * Copy shareable link and text to clipboard.
   * Returns true if successful.
   */
  async copyToClipboard(): Promise<boolean> {
    const data = this.getShareData();
    if (!data) return false;

    const text = `${this.getShareText(data)}\n${data.url}`;

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard copy failed:', error);
      return false;
    }
  }
}
