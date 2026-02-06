import { Component, inject, signal } from '@angular/core';
import {
  SleepTimerService,
  SleepTimerDuration,
  SLEEP_TIMER_OPTIONS,
} from '../../services/sleep-timer.service';

@Component({
  selector: 'app-sleep-timer-button',
  templateUrl: './sleep-timer-button.html',
  styleUrl: './sleep-timer-button.scss',
})
export class SleepTimerButton {
  private readonly sleepTimerService = inject(SleepTimerService);

  readonly options = SLEEP_TIMER_OPTIONS;
  readonly isActive = this.sleepTimerService.isActive;
  readonly formattedTime = this.sleepTimerService.formattedTime;
  readonly selectedDuration = this.sleepTimerService.selectedDuration;

  isMenuOpen = signal(false);

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  selectDuration(minutes: SleepTimerDuration): void {
    this.sleepTimerService.start(minutes);
    this.closeMenu();
  }

  cancelTimer(): void {
    this.sleepTimerService.cancel();
    this.closeMenu();
  }

  onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }
}
