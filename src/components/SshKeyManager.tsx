import * as React from 'react';
import { useState, useEffect } from 'react';
import { SshKey, TunnelServer } from '../types';
import { encryptText, decryptText, generateKeyFingerprint } from '../utils/crypto';
import {
  Key,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Check,
  FileText,
  Shield,
  ShieldCheck,
  AlertCircle,
  Fingerprint,
  Info,
  Server,
  Sparkles,
  Copy,
  X,
} from 'lucide-react';

interface SshKeyManagerProps {
  servers: TunnelServer[];
  onUpdateServers: (updated: TunnelServer[]) => void;
  isConnected: boolean;
  pushLog: (message: string, type: 'info' | 'debug' | 'success' | 'error' | 'warning') => void;
}

export default function SshKeyManager({
  servers,
  onUpdateServers,
  isConnected,
  pushLog,
}: SshKeyManagerProps) {
  // Local state for keys
  const [sshKeys, setSshKeys] = useState<SshKey[]>(() => {
    try {
      const saved = localStorage.getItem('gln_ssh_keys');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI state
  const [isAddingKey, setIsAddingKey] = useState<boolean>(false);
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  
  // New Key Form State
  const [keyName, setKeyName] = useState<string>('');
  const [privateKeyText, setPrivateKeyText] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [isSecureStorage, setIsSecureStorage] = useState<boolean>(true);
  const [masterPassword, setMasterPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [hasPassphrase, setHasPassphrase] = useState<boolean>(false);
  const [keyPassphrase, setKeyPassphrase] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Decryption popup states
  const [showDecryptModal, setShowDecryptModal] = useState<boolean>(false);
  const [modalKeyId, setModalKeyId] = useState<string | null>(null);
  const [modalPassword, setModalPassword] = useState<string>('');
  const [decryptedKeyContent, setDecryptedKeyContent] = useState<string | null>(null);
  const [decryptedPassphrase, setDecryptedPassphrase] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Copied alert state
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Save keys list to localStorage
  const saveKeysList = (updatedKeys: SshKey[]) => {
    setSshKeys(updatedKeys);
    localStorage.setItem('gln_ssh_keys', JSON.stringify(updatedKeys));
  };

  const resetForm = () => {
    setKeyName('');
    setPrivateKeyText('');
    setComment('');
    setIsSecureStorage(true);
    setMasterPassword('');
    setConfirmPassword('');
    setHasPassphrase(false);
    setKeyPassphrase('');
    setFormError(null);
    setIsAddingKey(false);
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!keyName.trim()) {
      setFormError('Please provide a descriptive name for this key.');
      return;
    }

    if (!privateKeyText.trim() || !privateKeyText.includes('PRIVATE KEY')) {
      setFormError('Please enter a valid RSA or OpenSSH Private Key block.');
      return;
    }

    if (isSecureStorage) {
      if (!masterPassword) {
        setFormError('Master password is required for secure local storage.');
        return;
      }
      if (masterPassword !== confirmPassword) {
        setFormError('Master passwords do not match.');
        return;
      }
    }

    try {
      // 1. Calculate visual fingerprint
      const fingerprint = generateKeyFingerprint(privateKeyText);

      // 2. Encrypt or store raw based on user selection
      let encryptedKeyText = privateKeyText.trim();
      let encryptedPassphraseText = hasPassphrase ? keyPassphrase.trim() : '';

      if (isSecureStorage) {
        // Encrypt key text with Master Password
        encryptedKeyText = await encryptText(privateKeyText.trim(), masterPassword);
        if (hasPassphrase && keyPassphrase) {
          encryptedPassphraseText = await encryptText(keyPassphrase.trim(), masterPassword);
        }
      }

      const newKey: SshKey = {
        id: `key-${Date.now()}`,
        name: keyName.trim(),
        comment: comment.trim() || undefined,
        privateKeyEncrypted: encryptedKeyText,
        isEncrypted: isSecureStorage,
        fingerprint,
        passphraseEnabled: hasPassphrase,
        passphrase: hasPassphrase ? encryptedPassphraseText : undefined,
        createdAt: new Date().toISOString(),
      };

      const updatedKeys = [...sshKeys, newKey];
      saveKeysList(updatedKeys);
      pushLog(`Successfully saved SSH Key Profile [${newKey.name}] locally.`, 'success');
      resetForm();
    } catch (err: any) {
      setFormError(`Encryption error: ${err.message || err}`);
    }
  };

  const handleDeleteKey = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnected) {
      pushLog('Cannot delete SSH keys while tunnel gateway is active.', 'warning');
      return;
    }

    if (window.confirm(`Are you sure you want to permanently delete the SSH Key Profile "${name}"?`)) {
      const updatedKeys = sshKeys.filter(k => k.id !== id);
      saveKeysList(updatedKeys);
      
      // Also clean up any custom servers linking to this deleted key
      const updatedServers = servers.map(srv => {
        if (srv.sshKeyId === id) {
          return { ...srv, sshKeyId: undefined, sshAuthMode: 'password' as const };
        }
        return srv;
      });
      onUpdateServers(updatedServers);
      localStorage.setItem('gln_custom_servers', JSON.stringify(updatedServers));

      pushLog(`Permanently removed local SSH Key: ${name}.`, 'warning');
    }
  };

  const handleDecryptKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const targetKey = sshKeys.find(k => k.id === modalKeyId);
    if (!targetKey) return;

    try {
      if (targetKey.isEncrypted) {
        // Standard decryption
        const decrypted = await decryptText(targetKey.privateKeyEncrypted, modalPassword);
        setDecryptedKeyContent(decrypted);

        if (targetKey.passphraseEnabled && targetKey.passphrase) {
          const decryptedPass = await decryptText(targetKey.passphrase, modalPassword);
          setDecryptedPassphrase(decryptedPass);
        }
        pushLog(`Successfully verified master password and decrypted key profile: ${targetKey.name}.`, 'success');
      } else {
        // It was stored in plain text
        setDecryptedKeyContent(targetKey.privateKeyEncrypted);
        if (targetKey.passphrase) {
          setDecryptedPassphrase(targetKey.passphrase);
        }
      }
    } catch (err: any) {
      setModalError(err.message || 'Decryption failed.');
    }
  };

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleAssociateKeyWithServer = (serverId: string, keyId: string | undefined) => {
    if (isConnected) {
      pushLog('Please disconnect the current tunnel session before altering server authentications.', 'warning');
      return;
    }

    const updated = servers.map(srv => {
      if (srv.id === serverId) {
        const authMode = keyId ? ('key' as const) : ('password' as const);
        return {
          ...srv,
          sshKeyId: keyId,
          sshAuthMode: authMode
        };
      }
      return srv;
    });

    onUpdateServers(updated);
    localStorage.setItem('gln_custom_servers', JSON.stringify(updated));

    const srvName = servers.find(s => s.id === serverId)?.name || 'Custom server';
    const keyName = sshKeys.find(k => k.id === keyId)?.name || 'None';

    if (keyId) {
      pushLog(`Configured server [${srvName}] to automate authentication using private key [${keyName}].`, 'success');
    } else {
      pushLog(`Reverted server [${srvName}] authentication profile to standard credential password.`, 'info');
    }
  };

  const customServers = servers.filter(s => s.isCustomConfig && (s.customType === 'SSH' || !s.customType));

  return (
    <div className="space-y-6">
      {/* Introduction Banner */}
      <div className="bg-[#112d37] border border-teal-500/20 rounded-2xl p-5 shadow-[0_4px_25px_rgba(13,148,136,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl -mr-8 -mt-8 pointer-events-none"></div>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-sans tracking-tight">SSH Private Key Locker</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
              Manage and store SSH RSA/OpenSSH cryptographic keys locally on your device. Securely encrypt them
              in your browser storage with a master password, and automatically authenticate custom SSH tunnel configurations
              for a hands-free, automated connection handshake.
            </p>
          </div>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Keys List and Management */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#0f0f12] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-emerald-400" />
                <h3 className="font-sans font-bold text-white text-sm">Stored Key Profiles ({sshKeys.length})</h3>
              </div>
              <button
                id="btn-add-ssh-key-toggle"
                onClick={() => {
                  if (isConnected) {
                    pushLog('Disconnect gateway to modify secure key repositories.', 'warning');
                    return;
                  }
                  setIsAddingKey(!isAddingKey);
                }}
                className="flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 shadow-[0_4px_15px_rgba(20,184,166,0.2)]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Key Profile</span>
              </button>
            </div>

            {/* List block */}
            {sshKeys.length === 0 ? (
              <div className="border border-white/5 bg-white/[0.01] rounded-xl p-8 text-center text-slate-500 space-y-2">
                <Shield className="w-8 h-8 mx-auto text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-400">No SSH Keys Found</p>
                <p className="text-[11px] max-w-md mx-auto leading-normal">
                  Your browser storage is currently empty of key credentials. Add a key profile to map against SSH, SSH SSL, or SSH Websocket servers.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sshKeys.map((key) => {
                  const isLinkedToSomeServer = servers.some(s => s.sshKeyId === key.id);
                  return (
                    <div
                      key={key.id}
                      onClick={() => {
                        setModalKeyId(key.id);
                        setModalPassword('');
                        setDecryptedKeyContent(null);
                        setDecryptedPassphrase(null);
                        setModalError(null);
                        setShowDecryptModal(true);
                      }}
                      className="group border border-white/5 hover:border-teal-500/30 bg-white/[0.01] hover:bg-white/[0.03] rounded-xl p-4 transition-all duration-300 cursor-pointer space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg border ${key.isEncrypted ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                            {key.isEncrypted ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors">
                              {key.name}
                            </h4>
                            <span className="text-[9px] font-mono text-slate-500 block">
                              Stored: {new Date(key.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteKey(key.id, key.name, e)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-white/5 transition-all opacity-0 group-hover:opacity-100"
                          title="Delete Key Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {key.comment && (
                        <p className="text-[10px] text-slate-400 italic bg-black/20 p-1.5 rounded border border-white/5 font-mono truncate">
                          # {key.comment}
                        </p>
                      )}

                      {/* Fingerprint block */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                          <Fingerprint className="w-3 h-3 text-slate-500" />
                          <span>Fingerprint</span>
                        </div>
                        <p className="font-mono text-[9px] text-teal-400 bg-black/40 border border-white/5 px-2 py-1 rounded select-all truncate">
                          {key.fingerprint}
                        </p>
                      </div>

                      {/* Metadata badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {key.isEncrypted && (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black font-mono px-1.5 py-0.5 rounded tracking-wider uppercase">
                            Storage Encrypted
                          </span>
                        )}
                        {key.passphraseEnabled && (
                          <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[8px] font-black font-mono px-1.5 py-0.5 rounded tracking-wider uppercase">
                            Key Passphrase
                          </span>
                        )}
                        {isLinkedToSomeServer && (
                          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black font-mono px-1.5 py-0.5 rounded tracking-wider uppercase flex items-center gap-0.5">
                            <Server className="w-2.5 h-2.5" /> Active Link
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Key Associations Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0f0f12] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              <h3 className="font-sans font-bold text-white text-sm">Server Auth Association</h3>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-normal">
              Map your saved SSH private keys to specific custom SSH servers. When selected, the tunnel engine will automatically deploy public key challenge parameters instead of requesting passwords.
            </p>

            {customServers.length === 0 ? (
              <div className="border border-white/5 bg-white/[0.01] rounded-xl p-5 text-center text-slate-500 text-[11px] space-y-1">
                <Info className="w-5 h-5 mx-auto text-slate-600" />
                <p className="font-semibold text-slate-400">No Custom SSH Servers</p>
                <p>Go to Custom Servers tab on the left to add your private SSH nodes.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {customServers.map((srv) => (
                  <div key={srv.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{srv.name}</span>
                        <span className="text-[9px] font-mono text-slate-500">[{srv.ip}]</span>
                      </div>
                      <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[8px] font-black px-1.5 py-0.5 rounded font-mono">
                        SSH
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[8px] font-extrabold uppercase tracking-widest text-slate-500">
                        Auth Mode / Key Profile
                      </label>
                      <select
                        value={srv.sshKeyId || ''}
                        onChange={(e) => handleAssociateKeyWithServer(srv.id, e.target.value ? e.target.value : undefined)}
                        className="w-full text-xs border border-white/10 rounded-lg p-2 bg-black/40 text-white outline-none focus:border-teal-500 font-mono cursor-pointer"
                      >
                        <option value="">🔑 Passphrase / Cleartext Password</option>
                        {sshKeys.map(k => (
                          <option key={k.id} value={k.id}>
                            🔐 {k.name} ({k.isEncrypted ? 'Encrypted' : 'Plain'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add New Key Drawer / Form Overlay */}
      {isAddingKey && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Form Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h3 className="font-sans font-bold text-white text-base">Add Secure Key Profile</h3>
              </div>
              <button
                onClick={resetForm}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleCreateKey} className="p-6 overflow-y-auto space-y-4 text-left flex-1">
              {formError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl flex gap-2 items-center">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                    Key Profile Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My Private SG Droplet"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                    Optional Reference Comment
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. root@my-server-ip"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-500 mb-1 flex items-center justify-between">
                  <span>PEM Private Key Block</span>
                  <span className="text-[8px] font-mono text-emerald-400 font-bold lowercase">RSA or OpenSSH Format</span>
                </label>
                <textarea
                  required
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtcn&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                  rows={6}
                  value={privateKeyText}
                  onChange={(e) => setPrivateKeyText(e.target.value)}
                  className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-teal-500 font-mono resize-none leading-relaxed"
                />
              </div>

              {/* Secure Storage local encrypt setting */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">AES-GCM Storage Encryption</span>
                      <span className="text-[10px] text-slate-500 block">Strong client-side encryption before writing to browser database.</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isSecureStorage}
                      onChange={(e) => setIsSecureStorage(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                  </label>
                </div>

                {isSecureStorage && (
                  <div className="grid grid-cols-2 gap-3 pt-2 animate-fade-in">
                    <div>
                      <label className="block text-[8px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                        Master Password
                      </label>
                      <input
                        type="password"
                        required={isSecureStorage}
                        placeholder="••••••••••••"
                        value={masterPassword}
                        onChange={(e) => setMasterPassword(e.target.value)}
                        className="w-full text-xs border border-white/10 rounded-xl p-2 bg-black/40 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        required={isSecureStorage}
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full text-xs border border-white/10 rounded-xl p-2 bg-black/40 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Key Passphrase settings */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">SSH Private Key Passphrase</span>
                      <span className="text-[10px] text-slate-500 block">Enable if the key file itself requires a decryption passphrase.</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasPassphrase}
                      onChange={(e) => setHasPassphrase(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
                  </label>
                </div>

                {hasPassphrase && (
                  <div className="pt-1 animate-fade-in">
                    <label className="block text-[8px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                      Key Decryption Passphrase
                    </label>
                    <input
                      type="password"
                      required={hasPassphrase}
                      placeholder="e.g. MyKeySecretWord"
                      value={keyPassphrase}
                      onChange={(e) => setKeyPassphrase(e.target.value)}
                      className="w-full text-xs border border-white/10 rounded-xl p-2 bg-black/40 text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 shadow-[0_4px_25px_rgba(20,184,166,0.25)] cursor-pointer text-center"
                >
                  Save Key Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decrypt / View Key Modal */}
      {showDecryptModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <h3 className="font-sans font-bold text-white text-base">
                  {sshKeys.find(k => k.id === modalKeyId)?.name} Credential Inspect
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowDecryptModal(false);
                  setDecryptedKeyContent(null);
                  setDecryptedPassphrase(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-left">
              {!decryptedKeyContent ? (
                // Ask password if encrypted, or let them submit to view if plaintext
                <form onSubmit={handleDecryptKey} className="space-y-4">
                  {modalError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl flex gap-2 items-center">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p>{modalError}</p>
                    </div>
                  )}

                  {sshKeys.find(k => k.id === modalKeyId)?.isEncrypted ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-300">
                        This key profile is cryptographically locked with AES-GCM local storage encryption. Enter your Master Password to decrypt and read the contents.
                      </p>
                      <div>
                        <label className="block text-[8px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">
                          Master Decryption Password
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••••••"
                          value={modalPassword}
                          onChange={(e) => setModalPassword(e.target.value)}
                          className="w-full text-xs border border-white/10 rounded-xl p-2.5 bg-black/40 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-300">
                        This key profile is stored in cleartext. Confirm below to display the private key block.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDecryptModal(false)}
                      className="flex-1 py-2.5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 transition-all cursor-pointer text-center"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-[0_4px_15px_rgba(20,184,166,0.2)] cursor-pointer text-center"
                    >
                      {sshKeys.find(k => k.id === modalKeyId)?.isEncrypted ? 'Decrypt Key' : 'Reveal Key'}
                    </button>
                  </div>
                </form>
              ) : (
                // Show Decrypted Private Key contents
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[8px] font-extrabold uppercase tracking-widest text-slate-500">
                        PEM Cryptographic Block
                      </label>
                      <button
                        onClick={() => handleCopyToClipboard(decryptedKeyContent, 'pem')}
                        className="flex items-center gap-1 text-[10px] text-teal-400 hover:text-teal-300 font-bold transition-all"
                      >
                        {copiedKeyId === 'pem' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy block</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono leading-relaxed text-slate-300 bg-black border border-white/10 p-3 rounded-xl overflow-x-auto max-h-[180px] whitespace-pre-wrap select-all">
                      {decryptedKeyContent}
                    </pre>
                  </div>

                  {decryptedPassphrase && (
                    <div className="space-y-1 bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[8px] font-extrabold uppercase tracking-widest text-cyan-400 block">
                          Associated SSH Passphrase
                        </span>
                        <span className="text-xs font-mono text-white font-bold select-all">
                          {decryptedPassphrase}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyToClipboard(decryptedPassphrase, 'passphrase')}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors p-1"
                        title="Copy Passphrase"
                      >
                        {copiedKeyId === 'passphrase' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        setShowDecryptModal(false);
                        setDecryptedKeyContent(null);
                        setDecryptedPassphrase(null);
                      }}
                      className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold uppercase tracking-wider text-center cursor-pointer transition-colors"
                    >
                      Close inspector
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
