import { isPlatformServer } from '@angular/common';
import { Component, Input, PLATFORM_ID, inject } from '@angular/core';
import { ReflectionKind, TSDocElement, TSDocMethod, TSDocProject, TSDocProperty, TSDocTextElement } from '../tsdoc';

declare var Prism;

@Component({
  selector: 'app-docs-viewer',
  templateUrl: './docs-viewer.component.html',
  styleUrl: './docs-viewer.component.scss'
})
export class DocsViewerComponent {
  platformId = inject(PLATFORM_ID);

  @Input('packageName') packageName: string;
  @Input('a') elementNameA: string;
  @Input('b') elementNameB: string;
  @Input('c') elementNameC: string;

  docs: TSDocProject;
  element: TSDocElement;
  parent: TSDocElement;
  parentUrl: string;

  url: string;
  readme: string;

  Kind = ReflectionKind;

  async ngAfterViewInit() {
    if (!isPlatformServer(this.platformId)) {
      let response = await fetch(`/assets/docs/${this.packageName}.json`);
      this.docs = await response.json();
      this.element = this.docs;
      this.readme = this.getMarkdown(this.docs.readme);
      this.url = `/packages/${this.packageName}`;

      if (this.elementNameA)
        this.selectSubElement(this.elementNameA);
      if (this.elementNameB)
        this.selectSubElement(this.elementNameB);
      if (this.elementNameC)
        this.selectSubElement(this.elementNameC);
    }
  }

  private selectSubElement(name: string) {
    this.parent = this.element;
    this.parentUrl = this.url;
    this.element = this.element.children.find(x => x.name === name);

    if (!this.element) {
      alert(`No such thing ${name} under ${this.parent.name}`);
    }

    this.readme = this.getMarkdown(this.element.comment?.summary);
    this.url = `${this.url}/${name}`;
  }

  getGroupChildren(element: TSDocElement, ids: number[]) {
    return ids.map(id => element.children.find(x => x.id === id));
  }

  getMarkdown(elem: TSDocTextElement[]) {
    if (!elem)
      return undefined;
    return elem.map(x => x.text).join('');
  }

  getKindName(kind: number) {
    return ReflectionKind[kind];
  }

  isKind<T extends TSDocElement>(element: TSDocElement, kind: ReflectionKind): element is T {
    return element.kind === kind;
  }

  isProperty(element: TSDocElement) {
    if (this.isKind<TSDocProperty>(element, ReflectionKind.Property))
      return element;
    return undefined;
  }

  isMethod(element: TSDocElement) {
    if (this.isKind<TSDocMethod>(element, ReflectionKind.Method))
      return element;
    return undefined;
  }
}
