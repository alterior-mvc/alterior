
export class Response {
	constructor(
		public status : number, 
		public headers : string[][], 
		public body : string
	) {
	}

	public static created(url, body) : Response {
		return new Response(201, 
			[['Location', url]], 
			JSON.stringify(body)
		);
	}
}