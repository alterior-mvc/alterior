import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PackageHomeComponent } from './package-home.component';

describe('PackageHomeComponent', () => {
  let component: PackageHomeComponent;
  let fixture: ComponentFixture<PackageHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PackageHomeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PackageHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
