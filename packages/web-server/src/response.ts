export type EncodingType = 'json' | 'raw';
import { HttpError } from '@alterior/common';

export class Response {
	/**
	 * Constructs a new Response, with the given status code, headers, and 
	 * body. The body will be encoded as JSON by default. Use `encodeAs('raw')` 
	 * to disable JSON encoding.
	 */
	constructor(
		public status: number,
		headers: string[][] | any,
		body: any,
		isRawBody?: boolean
	) {
		// Normalize headers 

		if (typeof headers === 'object' && !headers.length)
			headers = Object.keys(headers).map(key => [key, headers[key]]);
		this.headers = headers;

		if (isRawBody === undefined)
			isRawBody = false;
		headers = headers || [];

		this.unencodedBody = body;
		this.encodeAs(isRawBody ? 'raw' : 'json');
	}

	/**
	 * Headers for the response, as an array of [key, value] tuple arrays.
	 */
	public headers: string[][];

	/**
	 * Body of the response.
	 */
	public body?: string | Buffer;

	/**
	 * Stores the raw, unencoded body in case the user calls encodeAs()
	 */
	public unencodedBody: any;

	/**
	 * Throw this response as an `HttpError`
	 */
	public throw() {
		throw new HttpError(this.status, this.body, this.headers);
	}

	private _encoding: 'raw' | 'json' | undefined;

	get encoding() {
		return this._encoding;
	}

	/**
	 * Change the encoding of the body in the response. By default, Response will encode the body contents as 
	 * JSON, even if the type of the value is a string. To send a body which is not JSON, you must call 
	 * encodeAs('raw').
	 */
	public encodeAs(encoding: EncodingType) {

		if (!['raw', 'json'].includes(encoding))
			throw new Error(`Unknown encoding '${encoding}'`);

		this._encoding = encoding;

		if (encoding === 'raw') {
			this.body = this.unencodedBody;
		} else if (encoding === 'json') {
			this.body = JSON.stringify(this.unencodedBody);

			if (!this.headers.find(x => x[0].toLowerCase() == 'content-type')) {
				this.headers.push(['Content-Type', 'application/json; charset=utf-8']);
			}

		} else {
			throw new Error(`Unknown encoding '${encoding}'`);
		}

		return this;
	}

	/**
	 * Attach the given header to this response and return itself for fluent calls.
	 */
	public header(name: string, value: string) {
		this.headers.push([name, value]);
		return this;
	}

	/**
	 * Return a 201 Created response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static created(url: string, body: any): Response {
		let response = new Response(201,
			[['Location', url]],
			body
		);

		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 200 OK response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static ok(body?: any) {
		let response = new Response(200, [], body);

		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 500 Internal Server Error response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static serverError(body?: any) {
		let response = new Response(500, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 400 Bad Request response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static badRequest(body?: any) {
		let response = new Response(400, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 404 Not Found response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static notFound(body?: any) {
		let response = new Response(404, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 401 Unauthorized response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static unauthorized(body?: any) {
		let response = new Response(401, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 403 Forbidden response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static forbidden(body?: any) {
		let response = new Response(403, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 100 Continue response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static continue(body?: any) {
		let response = new Response(100, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 101 Switching Protocols response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static switchingProtocols(body?: any) {
		let response = new Response(101, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 102 Processing response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static processing(body?: any) {
		let response = new Response(101, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 202 Accepted response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static accepted(body?: any) {
		let response = new Response(202, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 203 Non-Authoritative Information response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static nonAuthoritativeInformation(body: any) {
		let response = new Response(202, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 204 No Content response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static noContent() {
		let response = new Response(204, [], "");
		response.unencodedBody = "";
		return response;
	}

	/**
	 * Return a 205 Reset Content response. 
	 */
	public static resetContent() {
		let response = new Response(204, [], "");
		response.unencodedBody = "";
		return response;
	}

	/**
	 * Return a 206 Partial Content response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static partialContent(body: any) {
		let response = new Response(206, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 300 Multiple Choices response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 * There is no standard format for the body, but you should indicate Content-Type, and ideally provide a Location header indicating 
	 * the server's preferred choice. 
	 */
	public static multipleChoices(body: any) {
		let response = new Response(300, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 301 Moved Permanently response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static movedPermanently(url: string, body?: any) {
		let response = new Response(301, [['Location', url]], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 302 Found response with the given body (will be encoded as JSON, append encodeAs('raw') to disable). 
	 */
	public static found(url: string, body?: any) {
		let response = new Response(302, [['Location', url]], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 303 See Other response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 * Use this after a new resource is created from a PUT or POST request to send the user agent to the new resource
	 * without causing them to redirect future requests to the POST/PUT endpoint itself.  
	 */
	public static seeOther(url: string, body?: any) {
		let response = new Response(303, [['Location', url]], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 304 Not Modified response.
	 * This request should usually have a Date header on it as well.
	 */
	public static notModified() {
		let response = new Response(304, [], null);
		response.unencodedBody = null;
		return response;
	}

	/**
	 * Return a 305 Use Proxy response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 * Use this if you are restricting requests only to approved proxies, and the user is not an approved proxy. 
	 */
	public static useProxy(url: string, body?: any) {
		let response = new Response(302, [['Location', url]], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 307 Temporary Redirect response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).  
	 */
	public static temporaryRedirect(url: string, body?: any) {
		let response = new Response(307, [['Location', url]], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 402 Payment Required response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 * Caution: This status code has not been formally specified.  
	 */
	public static paymentRequired(body?: any) {
		let response = new Response(402, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 405 Method Not Allowed response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static methodNotAllowed(allowedMethods: string, body?: any) {
		let response = new Response(405, [['Allow', allowedMethods]], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 406 Not Acceptable response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static notAcceptable(body?: any) {
		let response = new Response(406, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 407 Proxy Authentication Required response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static proxyAuthenticationRequired(challenge: string, body?: any) {
		let response = new Response(407, [['Proxy-Authenticate', challenge]], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 408 Request Timeout response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static requestTimeout(body?: any) {
		let response = new Response(408, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 409 Conflict response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static conflict(body?: any) {
		let response = new Response(409, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 410 Gone response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static gone(body?: any) {
		let response = new Response(410, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 411 Length Required response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static lengthRequired(body?: any) {
		let response = new Response(411, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 412 Precondition Failed response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static preconditionFailed(body?: any) {
		let response = new Response(412, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 413 Request Entity Too Large response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static requestTooLarge(body?: any) {
		let response = new Response(413, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 414 Request-URI Too Long response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static uriTooLong(body?: any) {
		let response = new Response(414, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 415 Unsupported Media Type response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static unsupportedMediaType(body?: any) {
		let response = new Response(415, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 416 Unsupported Media Type response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static rangeNotSatisfiable(body?: any) {
		let response = new Response(416, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 417 Unsupported Media Type response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static expectationFailed(body?: any) {
		let response = new Response(417, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 501 Not Implemented response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static notImplemented(body?: any) {
		let response = new Response(501, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 502 Bad Gateway response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static badGateway(body?: any) {
		let response = new Response(502, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 503 Service Unavailable response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static serviceUnavailable(body?: any) {
		let response = new Response(503, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 504 Gateway Timeout response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static gatewayTimeout(body?: any) {
		let response = new Response(504, [], body);
		response.unencodedBody = body;
		return response;
	}

	/**
	 * Return a 505 HTTP Version Not Supported response with the given body (will be encoded as JSON, append encodeAs('raw') to disable).
	 */
	public static httpVersionNotSupported(body?: any) {
		let response = new Response(505, [], body);
		response.unencodedBody = body;
		return response;

	}
}