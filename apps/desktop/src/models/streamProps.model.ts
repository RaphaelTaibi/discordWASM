export default interface StreamProps {
    stream: MediaStream | null;
    username: string;
    isBright?: boolean;
    isSpeaking?: boolean;
}