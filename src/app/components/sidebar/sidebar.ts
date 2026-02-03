import { Component } from '@angular/core';
import { LosslessBadge } from '../lossless-badge/lossless-badge';
import { StreamInfo } from '../stream-info/stream-info';
import { NotificationToggle } from '../notification-toggle/notification-toggle';

@Component({
  selector: 'app-sidebar',
  imports: [LosslessBadge, StreamInfo, NotificationToggle],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {}
