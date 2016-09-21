export class ApplicationArgs {
	public get() {
		return process.argv.splice(0, 2);
	}
}