import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocDeclComponent } from './doc-decl.component';

describe('DocDeclComponent', () => {
  let component: DocDeclComponent;
  let fixture: ComponentFixture<DocDeclComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocDeclComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DocDeclComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
