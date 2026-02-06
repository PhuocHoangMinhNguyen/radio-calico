import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StreamInfo } from './stream-info';

describe('StreamInfo', () => {
  let component: StreamInfo;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StreamInfo],
    });

    component = TestBed.inject(StreamInfo);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
