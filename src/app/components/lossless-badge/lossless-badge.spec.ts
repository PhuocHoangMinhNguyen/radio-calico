import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LosslessBadge } from './lossless-badge';

describe('LosslessBadge', () => {
  let component: LosslessBadge;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LosslessBadge],
    });

    component = TestBed.inject(LosslessBadge);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
