import { Component } from '@angular/core';
import { LosslessBadge } from '../lossless-badge/lossless-badge';
import { StreamInfo } from '../stream-info/stream-info';

@Component({
  selector: 'app-sidebar',
  imports: [LosslessBadge, StreamInfo],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {}
