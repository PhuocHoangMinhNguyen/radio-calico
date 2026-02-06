import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SavedTracks } from './saved-tracks';
import { BookmarkService } from '../../services/bookmark.service';

describe('SavedTracks', () => {
  let component: SavedTracks;
  let mockBookmarkService: any;

  beforeEach(() => {
    // Mock BookmarkService
    mockBookmarkService = {
      bookmarks: signal([
        { title: 'Song 1', artist: 'Artist 1', savedAt: new Date().toISOString() },
        { title: 'Song 2', artist: 'Artist 2', savedAt: new Date().toISOString() },
      ]),
      count: signal(2),
      remove: vi.fn(),
      clearAll: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SavedTracks,
        { provide: BookmarkService, useValue: mockBookmarkService },
      ],
    });

    component = TestBed.inject(SavedTracks);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose bookmarks signal from BookmarkService', () => {
    expect(component.bookmarks).toBe(mockBookmarkService.bookmarks);
  });

  it('should expose count signal from BookmarkService', () => {
    expect(component.count).toBe(mockBookmarkService.count);
  });

  it('should initialize isExpanded as false', () => {
    expect(component.isExpanded()).toBe(false);
  });

  it('should toggle isExpanded when toggleExpanded is called', () => {
    expect(component.isExpanded()).toBe(false);

    component.toggleExpanded();
    expect(component.isExpanded()).toBe(true);

    component.toggleExpanded();
    expect(component.isExpanded()).toBe(false);
  });

  it('should call BookmarkService.remove when removeTrack is called', () => {
    component.removeTrack('Song 1', 'Artist 1');

    expect(mockBookmarkService.remove).toHaveBeenCalledWith('Song 1', 'Artist 1');
  });

  it('should call BookmarkService.clearAll and collapse when clearAll is called', () => {
    component.isExpanded.set(true);
    component.clearAll();

    expect(mockBookmarkService.clearAll).toHaveBeenCalled();
    expect(component.isExpanded()).toBe(false);
  });

  it('should reflect changes in bookmarks signal', () => {
    const newBookmarks = [
      { title: 'Song 3', artist: 'Artist 3', savedAt: new Date().toISOString() },
    ];
    mockBookmarkService.bookmarks.set(newBookmarks);

    expect(component.bookmarks()).toEqual(newBookmarks);
  });

  it('should reflect changes in count signal', () => {
    mockBookmarkService.count.set(5);
    expect(component.count()).toBe(5);

    mockBookmarkService.count.set(0);
    expect(component.count()).toBe(0);
  });
});
