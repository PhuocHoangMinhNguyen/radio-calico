import { Component, inject, signal } from '@angular/core';
import { ShareService } from '../../services/share.service';
import { HlsPlayerService } from '../../services/hls-player.service';

/**
 * Share button component with dropdown menu for social sharing options.
 */
@Component({
  selector: 'app-share-button',
  imports: [],
  templateUrl: './share-button.html',
  styleUrl: './share-button.scss',
})
export class ShareButton {
  private shareService = inject(ShareService);
  private hlsService = inject(HlsPlayerService);

  isMenuOpen = signal(false);
  copySuccess = signal(false);

  hasTrackInfo = this.hlsService.hasTrackInfo;
  canUseNativeShare = this.shareService.canUseNativeShare;

  toggleMenu(): void {
    this.isMenuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  async onShare(): Promise<void> {
    // On mobile, use native share API
    if (this.canUseNativeShare()) {
      await this.shareService.shareNative();
    } else {
      // On desktop, toggle dropdown menu
      this.toggleMenu();
    }
  }

  onShareTwitter(): void {
    this.shareService.shareToTwitter();
    this.closeMenu();
  }

  onShareFacebook(): void {
    this.shareService.shareToFacebook();
    this.closeMenu();
  }

  async onCopyLink(): Promise<void> {
    const success = await this.shareService.copyToClipboard();
    if (success) {
      this.copySuccess.set(true);
      // Reset after 2 seconds
      setTimeout(() => this.copySuccess.set(false), 2000);
    }
    this.closeMenu();
  }
}
