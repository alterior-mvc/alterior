
export interface FileUpload {
	mv(destinationFile, callback : (err) => void);
	name : string;
	data : Buffer;
	encoding : string;
	mimetype : string;
} 
