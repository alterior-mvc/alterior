
export interface FileUpload {
	mv(destinationFile: string, callback : (err: any) => void): void;
	name : string;
	data : Buffer;
	encoding : string;
	mimetype : string;
} 
