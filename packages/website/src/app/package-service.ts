export const PACKAGES: Package[] = [
    { name: 'platform-nodejs', image: '/assets/nodejs-square.svg' },
    { name: 'express', icon: 'extension' },
    { name: 'command-line', icon: 'terminal' },
    { name: 'functions', icon: 'functions' },
    { name: 'fastify', icon: 'extension' },
    { name: 'platform-angular', image: '/assets/angular-square.svg' },
    { name: 'annotations', icon: 'settings_input_component' },
    { name: 'common', icon: 'foundation' },
    { name: 'logging', icon: 'article' },
    { name: 'tasks', icon: 'task_alt' },
    { name: 'di', icon: 'hub' },
    { name: 'runtime', icon: 'grid_view' },
    { name: 'http', icon: 'settings_ethernet' },
    { name: 'terminal', icon: 'terminal' },
    { name: 'web-server', icon: 'language' },
];

interface Package {
    name: string;
    icon?: string;
    image?: string;
    description?: string;
}

export class PackagesService {
    all() {
        return PACKAGES;
    }
}