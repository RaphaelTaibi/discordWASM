import { useState } from 'react';
import { Copy, Check, Key, Hash, Volume2, Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import ServerSettingsModalProps from '../../models/server/serverSettingsModalProps.model';

/**
 * Modal displaying server settings.
 * Reveals the invite key and allows channel management (delete with confirmation).
 */
export const ServerSettingsModal = ({ isOpen, onClose, server, onDeleteChannel, onDeleteServer }: ServerSettingsModalProps) => {
  const [copied, setCopied] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteServer, setPendingDeleteServer] = useState(false);

  const handleCopy = async () => {
    if (!server.inviteKey) return;
    await navigator.clipboard.writeText(server.inviteKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId && onDeleteChannel) {
      onDeleteChannel(pendingDeleteId);
      setPendingDeleteId(null);
    }
  };

  const _channelIcon = (type: string) => {
    if (type === 'voice') return <Volume2 size={14} className="text-cyan-500/60" />;
    return <Hash size={14} className="text-cyan-500/60" />;
  };

  const _pendingChannel = pendingDeleteId
    ? server.channels.find(c => c.id === pendingDeleteId)
    : null;

  const _footer = (
    <button
      onClick={onClose}
      className="px-5 py-2.5 text-[14px] font-bold text-cyan-500/70 hover:text-cyan-300 transition-colors"
    >
      Fermer
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Paramètres du Serveur" widthClass="w-[480px]" footer={_footer}>
      <div className="flex flex-col gap-6">
        {/* Server name */}
        <div>
          <label className="block text-[11px] font-black text-cyan-500/70 uppercase tracking-widest mb-2">
            Nom du Serveur
          </label>
          <p className="text-cyan-50 font-bold text-lg">{server.name}</p>
        </div>

        {/* Invite key (owner only) */}
        {server.inviteKey && (
          <div>
            <label className="block text-[11px] font-black text-cyan-500/70 uppercase tracking-widest mb-3">
              <span className="inline-flex items-center gap-1.5">
                <Key size={12} /> Clé d'invitation
              </span>
            </label>
            <div className="relative group">
              <div className="absolute inset-0 bg-cyan-400/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center gap-2 bg-white/[0.04] border border-cyan-500/30 rounded-lg px-4 py-3 backdrop-blur-sm">
                <code className="flex-1 text-[13px] text-cyan-200 font-mono break-all select-all">
                  {server.inviteKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-2 rounded-md hover:bg-cyan-500/20 text-cyan-500/70 hover:text-cyan-300 transition-all border border-transparent hover:border-cyan-500/30 hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                  title="Copier"
                >
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-cyan-500/50">
              Partagez cette clé pour permettre à d'autres utilisateurs de rejoindre votre serveur.
            </p>
          </div>
        )}

        {/* Channel management */}
        {onDeleteChannel && server.channels.length > 0 && (
          <div>
            <label className="block text-[11px] font-black text-cyan-500/70 uppercase tracking-widest mb-3">
              Salons ({server.channels.length})
            </label>
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
              {server.channels.map(ch => (
                <div key={ch.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-cyan-500/10 hover:border-cyan-500/20 transition-all group">
                  <div className="flex items-center gap-2 min-w-0">
                    {_channelIcon(ch.type)}
                    <span className="text-[13px] text-cyan-100 font-medium truncate">{ch.name}</span>
                  </div>
                  <button
                    onClick={() => setPendingDeleteId(ch.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-md text-cyan-500/40 hover:text-red-400 transition-all hover:shadow-[0_0_10px_rgba(248,113,113,0.3)]"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete confirmation inline */}
        {_pendingChannel && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-in fade-in duration-200">
            <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[13px] text-cyan-100 font-bold mb-1">Supprimer « {_pendingChannel.name} » ?</p>
              <p className="text-[12px] text-cyan-100/50 mb-3">Cette action est irréversible.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="px-4 py-1.5 text-[12px] font-bold text-cyan-500/70 hover:text-cyan-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[12px] font-bold rounded-lg border border-red-500/40 hover:shadow-[0_0_15px_rgba(248,113,113,0.3)] transition-all"
                >
                  Confirmer la suppression
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Members count */}
        <div>
          <label className="block text-[11px] font-black text-cyan-500/70 uppercase tracking-widest mb-2">
            Membres
          </label>
          <p className="text-cyan-50 font-medium">
            {server.members.length} membre{server.members.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Danger zone — delete server */}
        {onDeleteServer && (
          <div className="border-t border-red-500/20 pt-5">
            <label className="block text-[11px] font-black text-red-400/70 uppercase tracking-widest mb-3">
              Zone de danger
            </label>
            {!pendingDeleteServer ? (
              <button
                onClick={() => setPendingDeleteServer(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[13px] font-bold rounded-lg border border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(248,113,113,0.3)] transition-all w-full justify-center"
              >
                <Trash2 size={15} />
                Supprimer le serveur
              </button>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-in fade-in duration-200">
                <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[13px] text-cyan-100 font-bold mb-1">Supprimer « {server.name} » ?</p>
                  <p className="text-[12px] text-cyan-100/50 mb-3">Cette action est irréversible. Tous les salons et données seront perdus.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingDeleteServer(false)}
                      className="px-4 py-1.5 text-[12px] font-bold text-cyan-500/70 hover:text-cyan-300 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => { onDeleteServer(); onClose(); }}
                      className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[12px] font-bold rounded-lg border border-red-500/40 hover:shadow-[0_0_15px_rgba(248,113,113,0.3)] transition-all"
                    >
                      Confirmer la suppression
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

