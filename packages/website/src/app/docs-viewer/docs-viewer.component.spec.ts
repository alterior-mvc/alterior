import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocsViewerComponent } from './docs-viewer.component';

describe('DocsViewerComponent', () => {
  let component: DocsViewerComponent;
  let fixture: ComponentFixture<DocsViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocsViewerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DocsViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
