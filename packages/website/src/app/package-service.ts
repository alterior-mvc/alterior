export const PACKAGES: Package[] = [
    { 
        name: 'platform-nodejs', 
        image: '/assets/nodejs-square.svg',
        description: 'Use Alterior apps in Node.js'
    },
    { 
        name: 'express', 
        icon: 'extension',
        description: 'Provides a web server engine for Alterior using Express.js'
    },
    { 
        name: 'command-line', 
        icon: 'terminal',
        description: 'Command line processing'
    },
    { 
        name: 'functions', 
        icon: 'functions',
        description: 'Functional utilities'
    },
    { 
        name: 'fastify', 
        icon: 'extension',
        description: 'Provides a web server engine for Alterior using Fastify'
    },
    { 
        name: 'platform-angular', 
        image: '/assets/angular-square.svg',
        description: 'Use Alterior modules in Angular apps'
    },
    { 
        name: 'annotations', 
        icon: 'settings_input_component',
        description: 'Create and interact with Typescript metadata decorators'
    },
    { 
        name: 'common', 
        icon: 'foundation',
        description: 'Useful utilities for Typescript apps'
    },
    { 
        name: 'logging', 
        icon: 'article',
        description: 'Configurable context-aware logging'
    },
    { 
        name: 'tasks',
        icon: 'task_alt',
        description: 'Flexible background task system'
    },
    { 
        name: 'di', 
        icon: 'hub',
        description: 'Flexible reflection-based dependency injection'
    },
    { 
        name: 'runtime', 
        icon: 'grid_view',
        description: 'Core runtime for Alterior apps'
    },
    { 
        name: 'http', 
        icon: 'settings_ethernet',
        description: 'Flexible and configurable HTTP client'
    },
    { 
        name: 'terminal', 
        icon: 'terminal',
        description: 'Utilities for terminal applications'
    },
    { 
        name: 'web-server', 
        icon: 'language',
        description: 'Declarative framework for building REST services'
    },
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