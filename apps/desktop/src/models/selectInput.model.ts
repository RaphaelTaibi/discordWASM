export interface SelectInputOption {
    value: string;
    label: string;
}

export interface SelectInputProps {
    value: string;
    options: SelectInputOption[];
    onChange: (value: string) => void;
    placeholder?: string;
}
