import { Component, inject, signal } from '@angular/core';
import { BookmarkService } from '../../services/bookmark.service';

@Component({
  selector: 'app-saved-tracks',
  templateUrl: './saved-tracks.html',
  styleUrl: './saved-tracks.scss',
})
export class SavedTracks {
  private readonly bookmarkService = inject(BookmarkService);

  readonly bookmarks = this.bookmarkService.bookmarks;
  readonly count = this.bookmarkService.count;

  isExpanded = signal(false);

  toggleExpanded(): void {
    this.isExpanded.update((v) => !v);
  }

  removeTrack(title: string, artist: string): void {
    this.bookmarkService.remove(title, artist);
  }

  clearAll(): void {
    this.bookmarkService.clearAll();
    this.isExpanded.set(false);
  }
}
