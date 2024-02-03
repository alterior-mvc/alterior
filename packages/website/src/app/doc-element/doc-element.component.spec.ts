import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocElementComponent } from './doc-element.component';

describe('DocElementComponent', () => {
  let component: DocElementComponent;
  let fixture: ComponentFixture<DocElementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocElementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DocElementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
