import {
  Component,
  inject,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  computed,
} from '@angular/core';
import { HlsPlayerService } from '../../services/hls-player.service';
import { KeyboardShortcutService } from '../../services/keyboard-shortcut.service';
import { NotificationService } from '../../services/notification.service';
import { SleepTimerButton } from '../sleep-timer-button/sleep-timer-button';

@Component({
  selector: 'app-player-bar',
  imports: [SleepTimerButton],
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.scss',
})
export class PlayerBar implements AfterViewInit, OnDestroy {
  private hlsService = inject(HlsPlayerService);
  private keyboardService = inject(KeyboardShortcutService);
  private notificationService = inject(NotificationService);

  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;

  private readonly streamUrl = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';

  // Expose signals for template
  isPlaying = this.hlsService.isPlaying;
  volume = this.hlsService.volume;
  currentTrack = this.hlsService.currentTrack;
  hasTrackInfo = this.hlsService.hasTrackInfo;
  coverUrl = this.hlsService.coverUrl;
  statusMessage = this.hlsService.statusMessage;
  isMuted = this.keyboardService.isMuted;

  // Notification signals for mobile toggle
  notificationPermission = this.notificationService.permission;
  notificationsEnabled = this.notificationService.isEnabled;
  notificationsSupported = this.notificationService.isSupported;

  // Computed signal for volume icon
  volumeIcon = computed(() => {
    const vol = this.volume();
    if (this.isMuted() || vol === 0) return 'volume_off';
    if (vol < 0.3) return 'volume_mute';
    if (vol < 0.7) return 'volume_down';
    return 'volume_up';
  });

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

  onToggleMute(): void {
    // Simulate pressing 'M' key to toggle mute
    this.keyboardService.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'm' }));
  }

  onNotificationToggle(): void {
    if (this.notificationPermission() === 'default') {
      this.notificationService.requestPermission();
    } else if (this.notificationPermission() === 'granted') {
      this.notificationService.toggleEnabled();
    }
  }
}
