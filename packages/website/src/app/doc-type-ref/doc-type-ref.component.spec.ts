import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocTypeRefComponent } from './doc-type-ref.component';

describe('DocTypeRefComponent', () => {
  let component: DocTypeRefComponent;
  let fixture: ComponentFixture<DocTypeRefComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocTypeRefComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DocTypeRefComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
