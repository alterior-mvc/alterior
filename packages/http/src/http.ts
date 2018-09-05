import { HttpError } from "@alterior/common";
import { Injectable } from "@alterior/di";

@Injectable()
export class Http {
    constructor() {

    }

    async get<T>(url : string): Promise<T> {
        return await this.fetchData<T>(url, {
            method: 'GET'
        });
    }

    async put<T = any>(url : string, object : T): Promise<T> {
        return await this.fetchData<T>(url, {
            method: 'PUT',
            body: JSON.stringify(object)
        });
    }

    async post<T = any>(url : string, object : T): Promise<T> {
        return await this.fetchData<T>(url, {
            method: 'POST',
            body: JSON.stringify(object)
        });
    }

    async patch<T = any>(url : string, object : Partial<T>): Promise<T> {
        return await this.fetchData<T>(url, {
            method: 'PATCH',
            body: JSON.stringify(object)
        });
    }

    async delete<ResponseT = any>(url : string): Promise<ResponseT> {
        return await this.fetchData<ResponseT>(url, {
            method: 'DELETE'
        });
    }

    async fetchData<T>(url : string, init? : RequestInit): Promise<T> {
        let response = await this.fetchResponse(url);
        let headersMap : string[][] = [];
        response.headers.forEach((value, key) => headersMap.push([key, value]));

        if (response.status >= 400)
            throw new HttpError(response.status, headersMap, await response.json());
        
        return await response.json();
    }
    
    async fetchResponse(url : string, init? : RequestInit): Promise<Response> {
        return await fetch(url, init);
    }
}