import { Component, inject, computed } from '@angular/core';
import { BookmarkService } from '../../services/bookmark.service';
import { HlsPlayerService } from '../../services/hls-player.service';

@Component({
  selector: 'app-bookmark-button',
  imports: [],
  templateUrl: './bookmark-button.html',
  styleUrl: './bookmark-button.scss',
})
export class BookmarkButton {
  private bookmarkService = inject(BookmarkService);
  private hlsService = inject(HlsPlayerService);

  hasTrackInfo = this.hlsService.hasTrackInfo;
  currentTrack = this.hlsService.currentTrack;

  isBookmarked = computed(() => {
    const track = this.currentTrack();
    if (!track) return false;
    return this.bookmarkService.isBookmarked(track.title, track.artist);
  });

  onToggleBookmark(): void {
    const track = this.currentTrack();
    if (!track) return;

    this.bookmarkService.toggle(track.title, track.artist);
  }
}
