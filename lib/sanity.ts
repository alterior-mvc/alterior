export class SanityCheckReporter {
	public reportSuccess()
	{
		console.log('Application passed sanity check.');
		process.exit(99);
	}

	public reportFailure(e : any)
	{
		console.log('Application failed sanity check.');
		console.error(e);
		process.exit(1);
	}
}