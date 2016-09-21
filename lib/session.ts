const session = require("express-session"); 

export function mongoSession(sessionSecret : string) {
	const MongoStore = require('connect-mongo')(session);
	return session({
		secret: sessionSecret,
		store: new MongoStore({
			db: this.db
		})
	})
}