import { Component, Input } from '@angular/core';
import { ReflectionKind, TSDocElement, TSDocProject, TSDocTextElement, is } from '../tsdoc';

@Component({
  selector: 'alt-doc-element',
  templateUrl: './doc-element.component.html',
  styleUrl: './doc-element.component.scss'
})
export class DocElementComponent {
  Kind = ReflectionKind;
  _element: TSDocElement;

  readme: string;

  @Input() showChildren = true;
  @Input() showDeclaration = true;
  @Input() parentUrl: string;

  @Input() get element() { return this._element; }
  set element(element) {
    this._element = element;
    if (is<TSDocProject>(element, () => element.kind === ReflectionKind.Project)) {
      this.readme = this.getMarkdown(element.readme); 
    }
  }

  getMarkdown(elem: TSDocTextElement[]) {
    if (!elem)
      return undefined;
    return elem.map(x => x.text).join('');
  }

  getGroupChildren(element: TSDocElement, ids: number[]) {
    return ids.map(id => element.children.find(x => x.id === id));
  }
}
