export class HttpException {
	constructor(public statusCode : number, public body : any) {
		if (typeof body === 'object')
			body = JSON.stringify(body);
	}
}