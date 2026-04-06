export default interface LoginViewProps {
    onLogin: (pseudo: string, password: string) => void;
    onRecover: (pseudo: string, password: string) => void;
}

