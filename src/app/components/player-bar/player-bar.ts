import {
  Component,
  inject,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';

@Component({
  selector: 'app-player-bar',
  imports: [],
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.scss',
})
export class PlayerBar implements AfterViewInit, OnDestroy {
  private hlsService = inject(HlsPlayerService);

  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;

  private readonly streamUrl = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';

  // Expose signals for template
  isPlaying = this.hlsService.isPlaying;
  volume = this.hlsService.volume;
  currentTrack = this.hlsService.currentTrack;
  hasTrackInfo = this.hlsService.hasTrackInfo;
  coverUrl = this.hlsService.coverUrl;
  statusMessage = this.hlsService.statusMessage;

  ngAfterViewInit(): void {
    if (this.audioPlayerRef) {
      this.hlsService.initializePlayer(this.audioPlayerRef.nativeElement, this.streamUrl);
    }
  }

  ngOnDestroy(): void {
    this.hlsService.destroy();
  }

  onTogglePlayPause(): void {
    this.hlsService.togglePlayPause();
  }

  onVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.hlsService.setVolume(Number(input.value));
  }
}
