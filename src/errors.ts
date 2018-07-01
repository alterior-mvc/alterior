export class HttpException {
	constructor(public statusCode : number, public headers : string[][], public body : any) {
		if (typeof body === 'object')
			body = JSON.stringify(body);
	}
}