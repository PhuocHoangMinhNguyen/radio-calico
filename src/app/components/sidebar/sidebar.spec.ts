import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let component: Sidebar;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [Sidebar],
    });

    component = TestBed.inject(Sidebar);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
