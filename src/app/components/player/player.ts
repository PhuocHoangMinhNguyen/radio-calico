import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';
import { LosslessBadge } from '../lossless-badge/lossless-badge';
import { AudioControls } from '../audio-controls/audio-controls';
import { VolumeControl } from '../volume-control/volume-control';
import { StatusDisplay } from '../status-display/status-display';
import { StreamInfo } from '../stream-info/stream-info';
import { NowPlaying } from '../now-playing/now-playing';
import { RecentlyPlayed } from '../recently-played/recently-played';

@Component({
  selector: 'app-player',
  imports: [LosslessBadge, AudioControls, VolumeControl, StatusDisplay, StreamInfo, NowPlaying, RecentlyPlayed],
  templateUrl: './player.html',
  styleUrl: './player.scss',
})
export class Player implements AfterViewInit, OnDestroy {
  private hlsService = inject(HlsPlayerService);

  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;

  private readonly streamUrl = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';

  ngAfterViewInit(): void {
    // Initialize the player after the view is ready
    if (this.audioPlayerRef) {
      this.hlsService.initializePlayer(
        this.audioPlayerRef.nativeElement,
        this.streamUrl
      );
    }
  }

  ngOnDestroy(): void {
    this.hlsService.destroy();
  }
}
