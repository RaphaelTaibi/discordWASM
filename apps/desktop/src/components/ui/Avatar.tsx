import { useMemo } from 'react';
import * as jdenticon from 'jdenticon';
import { AvatarProps } from '../../models/avatarProps.model';

/**
 * Displays a user avatar or a deterministic identicon generated from the public key.
 * Pure presentational component — no business logic.
 */
export const Avatar = ({ publicKey, avatarUrl, size = 32, className = '' }: AvatarProps) => {
    const identiconSvg = useMemo(() => {
        if (avatarUrl) return '';
        return jdenticon.toSvg(publicKey, size);
    }, [publicKey, size, avatarUrl]);

    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt="Avatar"
                width={size}
                height={size}
                className={`rounded-full object-cover ${className}`}
            />
        );
    }

    return (
        <div
            className={`rounded-full overflow-hidden ${className}`}
            style={{ width: size, height: size }}
            dangerouslySetInnerHTML={{ __html: identiconSvg }}
        />
    );
};

