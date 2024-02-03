import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MaterialModule } from './material.module';
import { HomeComponent } from './home/home.component';
import { RouterModule } from '@angular/router';
import { PackagesService } from './package-service';
import { PackageHomeComponent } from './package-home/package-home.component';
import { DocsViewerComponent } from './docs-viewer/docs-viewer.component';
import { TrustHtmlPipe } from './trust-html.pipe';
import { MarkdownToHtmlPipe } from './markdown-to-html.pipe';
import { DocTypeRefComponent } from './doc-type-ref/doc-type-ref.component';
import { DocDeclComponent } from './doc-decl/doc-decl.component';
import { DocSyntaxComponent } from './doc-syntax/doc-syntax.component';
import { DocElementComponent } from './doc-element/doc-element.component';
import { ShellComponent } from './shell/shell.component';
import { GettingStartedComponent } from './getting-started/getting-started.component';
import { TryItComponent } from './try-it/try-it.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    PackageHomeComponent,
    DocsViewerComponent,
    TrustHtmlPipe,
    MarkdownToHtmlPipe,
    DocTypeRefComponent,
    DocDeclComponent,
    DocSyntaxComponent,
    DocElementComponent,
    ShellComponent,
    GettingStartedComponent,
    TryItComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot([
      { path: '', component: HomeComponent },
      { 
        path: '', 
        component: ShellComponent,
        children: [
          { path: 'getting-started', component: GettingStartedComponent },
          { path: 'try', component: TryItComponent },
          { path: 'packages/:packageName', component: DocsViewerComponent },
          { path: 'packages/:packageName/:a', component: DocsViewerComponent },
          { path: 'packages/:packageName/:a/:b', component: DocsViewerComponent },
          { path: 'packages/:packageName/:a/:b/:c', component: DocsViewerComponent },
        ]
      }
      
    ], {
      bindToComponentInputs: true
    }),
    MaterialModule
  ],
  providers: [
    provideClientHydration(),
    provideAnimationsAsync(),
    PackagesService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
