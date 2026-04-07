import { useRef, useState, useEffect } from "react";
import { useVoiceStore } from "../context/VoiceContext";
import { useAuth } from "../context/AuthContext";

/**
 * Centralizes all profile-settings business logic.
 * Handles avatar management, username editing, clipboard actions and logout.
 * @returns State and callbacks consumed by the ProfileSettings component.
 */
export function useProfileSettings() {
    const { voiceAvatar, setVoiceAvatar } = useVoiceStore();
    const { username, publicKey, userTag, avatar, logout, updateUsername, updateAvatar } = useAuth();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [nameInputValue, setNameInputValue] = useState(username || '');
    const [isSaving, setIsSaving] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);
    const [tagCopied, setTagCopied] = useState(false);

    // Sync local input when the upstream username changes
    useEffect(() => {
        setNameInputValue(username || '');
    }, [username]);

    // Sync persisted avatar into VoiceStore on mount
    useEffect(() => {
        if (avatar && !voiceAvatar) {
            setVoiceAvatar(avatar);
        }
    }, [avatar]);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const _data = event.target?.result as string;
            setVoiceAvatar(_data);
            updateAvatar(_data);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveAvatar = () => {
        setVoiceAvatar(null);
        updateAvatar(null);
    };

    const handleSaveName = () => {
        const _trimmed = nameInputValue.trim();
        if (_trimmed && _trimmed !== username) {
            setIsSaving(true);
            updateUsername(_trimmed);
            setTimeout(() => setIsSaving(false), 300);
        }
    };

    const handleCopyTag = () => {
        if (!userTag) return;
        navigator.clipboard.writeText(userTag);
        setTagCopied(true);
        setTimeout(() => setTagCopied(false), 2000);
    };

    const handleCopyKey = () => {
        if (!publicKey) return;
        navigator.clipboard.writeText(publicKey);
        setKeyCopied(true);
        setTimeout(() => setKeyCopied(false), 2000);
    };

    const canSaveName = Boolean(nameInputValue.trim() && nameInputValue !== username);

    return {
        voiceAvatar,
        username,
        publicKey,
        userTag,
        fileInputRef,
        nameInputValue,
        setNameInputValue,
        isSaving,
        keyCopied,
        tagCopied,
        canSaveName,
        handleAvatarUpload,
        handleRemoveAvatar,
        handleSaveName,
        handleCopyTag,
        handleCopyKey,
        logout,
    };
}

