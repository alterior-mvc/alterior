
export function ellipsize(maxLength: number, str: string): string {
	if (str.length > maxLength)
		return str.slice(0, maxLength) + '...';

	return str;  
}