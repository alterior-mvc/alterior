
export interface CommandLineOption {
    id : string;
    description : string;
    short? : string;
    valueHint? : string;
    values? : string[];
    value? : string;
    present? : boolean;
    handler? : () => void;
}
