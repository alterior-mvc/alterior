export interface BuildConfig {
    /**
     * What type of project is this? A "service" is a backend application that runs on a server,
     * and exposes it's API as a client library.
     */
    projectType : 'service' | 'library';

    packageName?: string;
    packageVersion?: string;
    packageDescription?: string;
    packageAuthor?: string;
    packageLicense?: string;
    packageHomepage?: string;
    packageRepositoryUrl?: string;
    packageBugsUrl?: string;
    packageKeywords?: string[];
    
    service?: ServiceBuildConfig;
}


export interface ServiceBuildConfig {
    
    /**
     * When publishing your project to NPM, should the backend code be included?
     * If false, only the frontend code (the client portion) will be published to NPM.
     * If true, both the frontend and the backend code will be published, allowing your backend
     * to be run from the package itself.
     */
    publishBackend : boolean;
}