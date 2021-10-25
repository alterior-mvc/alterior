/**
 * Abstracts the fetching of the application's arguments. This is most useful for testing,
 * but could also be used if trying to host Alterior in a strange environment.
 */
export class ApplicationArgs {
	public get() {
		return process.argv.slice(2);
	}
}