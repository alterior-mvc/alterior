import * as express from 'express';
import * as url from 'url';

export function accessControl(req : express.Request, res : express.Response, next) {
	let referer = req.header("Referer") || req.header("Host");
	let refererUrl = url.parse(referer);
	let origin = `${refererUrl.protocol}//${refererUrl.host}`;

	res.setHeader("Access-Control-Allow-Origin", origin);
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");
	res.setHeader("Access-Control-Allow-Credentials", "true");
	res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
	
	next();
}