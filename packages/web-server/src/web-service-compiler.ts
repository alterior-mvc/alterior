import { ServiceCompiler, MethodShim } from '@alterior/runtime';
import { RouteReflector, WebEvent } from './metadata';
import { InputAnnotation } from './input';
import { describe } from 'razmin';

export class WebServiceCompiler extends ServiceCompiler {
    compileMethod(method : MethodShim) {
		let routeReflector = new RouteReflector(method.target);
        let route = routeReflector.routes.find(x => x.method === method.name);
        if (!route)
            throw new Error(`Cannot find route for method ${method.target.name}#${method.name}()`);

        let mutators : string[] = [];
        let inputs = InputAnnotation.getAllForParameters(method.target, method.name) || [];
        let index = -1;
        let url = `${route.path}`;
        let pathParamNames : string[] = Array.from((url.match(/:([A-Za-z0-9]+)/g) || []).map(x => x.slice(1)));

        for (let param of method.params) {
            index += 1;
            let input = (inputs[index] || [])[0];
            if (input) {
                if (input.type === 'queryParam') {
                    mutators.push(`queryParams['${input.name}'] = ${param.name} ?? ${JSON.stringify(param.default)};`);
                } else if (input.type === 'queryParams') {
                    mutators.push(`queryParams = { ...queryParams, ...(${param.name} ?? {}) };`);
                } else if (input.type === 'session') {
                    throw new Error(`Transparent service cannot have a @Session() parameter`);
                } else if (input.type === 'response') {
                    throw new Error(`Transparent service cannot have a @Response() parameter`);
                } else if (input.type === 'path') {
                    url = url.replace(new RegExp(`:${input.name}\\b`, 'g'), `\${param.name}`);
                    //mutators.push(`url = url.replace(/:${param.name}\\b/g, encodeURIComponent(${param.name}));`);
                } else if (input.type === 'body') {
                    mutators.push(`request.body = JSON.stringify(${param.name})`);
                    mutators.push(`request.headers['content-type'] = 'application/json';`);
                } else {
                    throw new Error(`Unknown @Input type: ${input.type || '<none>'}`);
                }
            } else {

                // See if the name matches any expected parameter

                if (param.name === 'body') {
                    // implicit body
                    mutators.push(`request.body = JSON.stringify(${param.name})`);
                    mutators.push(`request.headers['content-type'] = 'application/json';`);
                } else if (pathParamNames.includes(param.name.slice(1))) {
                    // implicit path param
                    url = url.replace(new RegExp(`:${param.name.slice(1)}\\b`, 'g'), `\${${param.name}}`);
                    //mutators.push(`url = url.replace(/:${param.name}\\b/g, encodeURIComponent(${param.name}));`);
                } else if (param.type === WebEvent) {
                    throw new Error(`Transparent service cannot have a RouteEvent parameter`);
                } else {
                    throw new Error(`${method.target.name}#${method.name}(): Not sure how to handle parameter '${param.name}'`);
                    // console.warn(`${method.target.name}#${method.name}(): Unused parameter ${param.name}`);
                    // mutators.push(`// Parameter ${param.name} is unused`)
                } 
            }
            
        }

        method.body = `
            let url = \`${url}\`;
            let queryParams = {};
            let request : RequestInit = { 
                method: '${route.httpMethod}',
                headers: {}
            };
            ${mutators.join("\n")}

            url += \`?\${Object.keys(queryParams).map(key => \`\${encodeURIComponent(key)}=\${encodeURIComponent(queryParams[key])}\`).join('&')}\`;
            let response = await fetch(url, request);
            if (response.status >= 400)
                throw new Error(\`\${response.status}\ \${response.statusText}\`);
            return await response.json();
        `;
    }

}