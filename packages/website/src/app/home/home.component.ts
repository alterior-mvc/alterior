import { Component, inject } from '@angular/core';
import { PackagesService } from '../package-service';
import { MENU } from '../menu';
import { UIService } from '../ui.service';

declare var Prism;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  packagesService = inject(PackagesService);
  uiService = inject(UIService);

  packages = this.packagesService.all();
  menu = MENU;
  webServiceExample: string;
  readme: Section;

  async ngOnInit() {
    let response = await fetch(`/assets/README.md`);
    let readme = await response.text();

    readme = readme.split(`\n`).slice(5).join("\n");

    readme = readme.replace(/\(packages\/([^\/]+)\/README.md\)/g, "(/packages/$1)")

    this.readme = this.parseSections(readme);

    visitSections(this.readme, section => {
      this.readmeSections[section.id] = section;
      return true;
    });

    this.webServiceExample = getSectionById(this.readme, 'getting-started').content.join("\n");

    this.uiService.pageFinishedLoading();
  }

  private readmeSections: Record<string, Section> = {};

  readmeSection(id: string) {
    return this.readmeSections[id]?.content.join("\n") ?? "";
  }

  getSection(markdown: string, name: string) {
    let lines = markdown.replace(/\r\n/g, "\n").split(`\n`);
    let startOfSection = lines.findIndex(line => this.getHeaderName(line) === name);
    if (startOfSection === undefined)
      return undefined;

    let headerLine = lines[startOfSection];
    let level = headerLine.replace(/[^#].*/, '');

    let nextHeaderLine = lines.findIndex((line, index) => index > startOfSection && line.startsWith(`${level} `));
    if (nextHeaderLine < 0)
      nextHeaderLine = lines.length;

    return lines.slice(startOfSection + 1, nextHeaderLine).join("\n");
  }

  getHeaderName(headerLine: string) {
    if (!headerLine.trim().startsWith('#'))
      return undefined;
    return headerLine.trim().replace(/^#+ +/, '').replace(/  +/g, ' ').replace(/ /g, '-').toLowerCase();
  }

  parseSections(markdown: string): Section {
    let lines = markdown.replace(/\r\n/g, "\n").split(`\n`);
    let rootSection: Section = {
      id: 'root',
      name: '',
      content: [],
      sections: [],
      level: 0
    };

    let section = rootSection;

    for (let line of lines) {
      if (line.trim().startsWith('#')) {
        let level = line.trim().replace(/[^#].*/, '').length;
        while (level < section.level && section.parent)
          section = section.parent;

        if (level === section.level) {
          section = section.parent;
          let newSection: Section = {
            content: [],
            id: this.getHeaderName(line),
            level,
            name: line.replace(/#+ /, ''),
            sections: [],
            parent: section
          }
          section.sections.push(newSection);
          section = newSection;
        } else if (level > section.level) {
          let newSection: Section = {
            content: [],
            id: this.getHeaderName(line),
            level,
            name: line.replace(/#+ /, ''),
            sections: [],
            parent: section
          }

          section.sections.push(newSection);
          section = newSection;
        }
      } else {
        section.content.push(line);
      }
    }

    console.dir(rootSection);

    visitSections(rootSection, section => {
      delete section.parent;
      return true;
    });
    
    return rootSection;
  }
}

function getSectionById(root: Section, id: string): Section | undefined {
  let match: Section | undefined;

  visitSections(root, section => {
    if (section.id === id) {
      match = section;
      return false;
    }
    return true;
  })

  return match;
}

function visitSections(root: Section, callback: (section: Section) => boolean) {
  if (!callback(root)) {
    return false;
  }

  for (let section of root.sections) {
    if (!visitSections(section, callback))
      return false;
  }

  return true;
}

interface Section {
  name: string;
  id: string;
  content: string[];
  sections: Section[];
  level: number;
  parent?: Section;
}