export type TunnelProtocol = 'SSH' | 'VMESS' | 'VLESS' | 'TROJAN' | 'SSH_WEBSOCKET';

export interface Profile {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  privateKeyPath?: string;
  privateKeyPassphrase?: string;
  dnsPrimary?: string;
  dnsSecondary?: string;
  localSocksPort?: number;
  killSwitch?: boolean;
  splitTunnelMode?: 'off' | 'include' | 'exclude';
  splitTunnelApps?: string[];
  mtu?: number;
}

export interface SshKey {
  id: string;
  name: string;
  comment?: string;
  privateKeyEncrypted: string; // Encrypted private key block
  isEncrypted: boolean;        // Whether the storage of this key is encrypted by a master password
  fingerprint: string;         // SSH visual fingerprint
  passphraseEnabled: boolean;  // Whether the SSH key itself requires a decryption passphrase
  passphrase?: string;         // Passphrase for the key
  createdAt: string;
}

export interface TunnelServer {
  id: string;
  name: string;
  country: string;
  flag: string;
  ip: string;
  load: number; // 0 to 100
  ping: number; // base ping in ms
  ports: number[];
  isCustomConfig?: boolean;
  customType?: 'SSH' | 'VMESS' | 'VLESS' | 'TROJAN';
  target?: string;
  proxyEnabled?: boolean;
  proxy?: string;
  sniEnabled?: boolean;
  sni?: string;
  payload?: string;
  uuid?: string;
  password?: string;
  network?: 'tls' | 'websocket' | 'grpc';
  tlsEnabled?: boolean;
  muxEnabled?: boolean;
  path?: string;
  headerHost?: string;
  locked?: boolean;
  sshAuthMode?: 'password' | 'key'; // 'password' (default) or 'key'
  sshKeyId?: string;                 // Linked SshKey ID
}

export interface PayloadConfig {
  method: 'GET' | 'POST' | 'CONNECT' | 'PUT' | 'HEAD';
  bugHost: string;
  split: 'none' | 'normal' | 'instant_split' | 'delay_split';
  extraHeaders: {
    keepAlive: boolean;
    onlineHost: boolean;
    userAgent: boolean;
    referer: boolean;
    forwardHost: boolean;
  };
  customPayload: string;
  uid?: string;
  proxyRoute?: string;
}

export interface SpeedTestState {
  phase: 'idle' | 'ping' | 'download' | 'upload' | 'completed';
  ping: number;
  download: number; // MB/s
  upload: number; // MB/s
  progress: number; // 0 to 100
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  type: 'info' | 'debug' | 'success' | 'error' | 'warning';
  message: string;
}

export interface AppRule {
  id: string;
  name: string;
  packageName: string;
  icon: string;
  route: boolean; // true = route through tunnel, false = bypass
  isSystem?: boolean;
}

export interface AdvancedSettings {
  dnsType: 'cloudflare' | 'google' | 'adguard' | 'custom';
  customDnsPrimary: string;
  customDnsSecondary: string;
  localPort: number;
  mtu: number;
  enableUdp: boolean;
  reconnectAttempts: number;
  slowDnsKey: string;
  slowDnsNs: string;
  sshConnectFrom?: 'direct' | 'dns' | 'http_proxy' | 'http_obfs' | 'tls_proxy' | 'tls_obfs' | 'tls_stunnel';
  sshCustomPayload?: boolean;
  enableAesNi?: boolean;
  enableKernelRouting?: boolean;
}
