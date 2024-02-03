import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocSyntaxComponent } from './doc-syntax.component';

describe('DocSyntaxComponent', () => {
  let component: DocSyntaxComponent;
  let fixture: ComponentFixture<DocSyntaxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocSyntaxComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DocSyntaxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
