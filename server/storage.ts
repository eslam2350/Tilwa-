import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AiProposalRecord,
  AnalyticsSummary,
  AuditLogEntry,
  BackupFileItem,
  BackupSnapshotMeta,
  BasiraCatalogData,
  DynamicAppConfig,
  SiteFeedbackItem,
} from '../src/types/tilawa.ts';

interface SessionMeta {
  tokenVersion: number;
}

export interface StoredBackupRecord extends BackupSnapshotMeta {
  files: BackupFileItem[];
  configSnapshot?: DynamicAppConfig | null;
  basiraSnapshot?: BasiraCatalogData | null;
}

const DEFAULT_ANALYTICS: AnalyticsSummary = {
  totalPageViews: 0,
  totalPlays: 0,
  routeCounts: {},
  reciterPlays: {},
  surahPlays: {},
  dailyViews: {},
  lastUpdatedAt: new Date().toISOString(),
};

export class ServerDataStore {
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly backupsDir: string;
  private readonly proposalsDir: string;
  private readonly basiraUploadsDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.dataDir = path.join(projectRoot, 'server-data');
    this.backupsDir = path.join(this.dataDir, 'backups');
    this.proposalsDir = path.join(this.dataDir, 'proposals');
    this.basiraUploadsDir = path.join(this.dataDir, 'uploads', 'basira');
    this.ensureDirs();
  }

  private ensureDirs(): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupsDir, { recursive: true });
    fs.mkdirSync(this.proposalsDir, { recursive: true });
    fs.mkdirSync(this.basiraUploadsDir, { recursive: true });
  }

  getBasiraUploadsDir(): string {
    this.ensureDirs();
    return this.basiraUploadsDir;
  }

  private readJsonFile<T>(filePath: string, fallback: T): T {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private writeJsonFile(filePath: string, value: unknown): void {
    this.ensureDirs();
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  }

  getTokenVersion(): number {
    const meta = this.readJsonFile<SessionMeta>(
      path.join(this.dataDir, 'session-meta.json'),
      { tokenVersion: 1 }
    );
    return typeof meta.tokenVersion === 'number' && meta.tokenVersion >= 1
      ? meta.tokenVersion
      : 1;
  }

  bumpTokenVersion(): number {
    const next = this.getTokenVersion() + 1;
    this.writeJsonFile(path.join(this.dataDir, 'session-meta.json'), {
      tokenVersion: next,
    });
    return next;
  }

  getSiteConfig(): DynamicAppConfig | null {
    return this.readJsonFile<DynamicAppConfig | null>(
      path.join(this.dataDir, 'site-config.json'),
      null
    );
  }

  saveSiteConfig(config: DynamicAppConfig): void {
    this.writeJsonFile(path.join(this.dataDir, 'site-config.json'), config);
  }

  getBasiraCatalog(): BasiraCatalogData | null {
    return this.readJsonFile<BasiraCatalogData | null>(
      path.join(this.dataDir, 'basira-catalog.json'),
      null
    );
  }

  saveBasiraCatalog(catalog: BasiraCatalogData): void {
    this.writeJsonFile(path.join(this.dataDir, 'basira-catalog.json'), catalog);
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.readJsonFile<AuditLogEntry[]>(
      path.join(this.dataDir, 'audit-log.json'),
      []
    );
  }

  appendAuditLog(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): AuditLogEntry {
    const logs = this.getAuditLogs();
    const record: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    const next = [record, ...logs].slice(0, 300);
    this.writeJsonFile(path.join(this.dataDir, 'audit-log.json'), next);
    return record;
  }

  getAnalytics(): AnalyticsSummary {
    return this.readJsonFile<AnalyticsSummary>(
      path.join(this.dataDir, 'analytics.json'),
      { ...DEFAULT_ANALYTICS }
    );
  }

  recordAnalyticsEvent(payload: {
    type: 'pageview' | 'play';
    route?: string;
    reciterId?: string;
    reciterName?: string;
    surahNumber?: number;
    surahName?: string;
  }): void {
    const current = this.getAnalytics();
    const today = new Date().toISOString().slice(0, 10);

    if (payload.type === 'pageview') {
      current.totalPageViews += 1;
      current.dailyViews[today] = (current.dailyViews[today] || 0) + 1;
      const routeKey = (payload.route || 'home').slice(0, 40);
      current.routeCounts[routeKey] = (current.routeCounts[routeKey] || 0) + 1;
    } else if (payload.type === 'play') {
      current.totalPlays += 1;
      if (payload.reciterId && payload.reciterName) {
        const recEntry = current.reciterPlays[payload.reciterId] || {
          name: payload.reciterName.slice(0, 80),
          count: 0,
        };
        recEntry.count += 1;
        recEntry.name = payload.reciterName.slice(0, 80);
        current.reciterPlays[payload.reciterId] = recEntry;
      }
      if (payload.surahNumber && payload.surahName) {
        const sKey = String(payload.surahNumber);
        const surahEntry = current.surahPlays[sKey] || {
          name: payload.surahName.slice(0, 80),
          count: 0,
        };
        surahEntry.count += 1;
        surahEntry.name = payload.surahName.slice(0, 80);
        current.surahPlays[sKey] = surahEntry;
      }
    }

    current.lastUpdatedAt = new Date().toISOString();
    this.writeJsonFile(path.join(this.dataDir, 'analytics.json'), current);
  }

  saveProposal(proposal: AiProposalRecord): void {
    this.writeJsonFile(path.join(this.proposalsDir, `${proposal.id}.json`), proposal);
  }

  getProposal(id: string): AiProposalRecord | null {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) return null;
    return this.readJsonFile<AiProposalRecord | null>(
      path.join(this.proposalsDir, `${safeId}.json`),
      null
    );
  }

  listProposals(): AiProposalRecord[] {
    this.ensureDirs();
    const files = fs.readdirSync(this.proposalsDir).filter((f) => f.endsWith('.json'));
    const list: AiProposalRecord[] = [];
    for (const f of files) {
      const rec = this.readJsonFile<AiProposalRecord | null>(
        path.join(this.proposalsDir, f),
        null
      );
      if (rec) list.push(rec);
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  }

  createBackupSnapshot(params: {
    label: string;
    reason: string;
    filePaths: string[];
    includeConfig?: boolean;
    includeBasira?: boolean;
  }): StoredBackupRecord {
    const id = `bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const files: BackupFileItem[] = [];

    for (const relPath of Array.from(new Set(params.filePaths))) {
      const absPath = path.resolve(this.projectRoot, relPath);
      if (!absPath.startsWith(path.resolve(this.projectRoot))) continue;
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        files.push({
          filePath: relPath,
          existedBefore: true,
          content: fs.readFileSync(absPath, 'utf8'),
        });
      } else {
        files.push({
          filePath: relPath,
          existedBefore: false,
          content: '',
        });
      }
    }

    const configSnapshot = params.includeConfig !== false ? this.getSiteConfig() : null;
    const basiraSnapshot = params.includeBasira === true ? this.getBasiraCatalog() : null;
    const record: StoredBackupRecord = {
      id,
      createdAt: new Date().toISOString(),
      label: params.label.slice(0, 120),
      reason: params.reason.slice(0, 240),
      filesCount: files.length,
      hasConfigSnapshot: Boolean(configSnapshot || basiraSnapshot),
      filesList: files.map((f) => f.filePath),
      files,
      configSnapshot,
      basiraSnapshot,
    };

    this.writeJsonFile(path.join(this.backupsDir, `${id}.json`), record);
    return record;
  }

  listBackups(): BackupSnapshotMeta[] {
    this.ensureDirs();
    const files = fs.readdirSync(this.backupsDir).filter((f) => f.endsWith('.json'));
    const out: BackupSnapshotMeta[] = [];
    for (const f of files) {
      const rec = this.readJsonFile<StoredBackupRecord | null>(
        path.join(this.backupsDir, f),
        null
      );
      if (rec) {
        out.push({
          id: rec.id,
          createdAt: rec.createdAt,
          label: rec.label,
          reason: rec.reason,
          filesCount: rec.filesCount,
          hasConfigSnapshot: rec.hasConfigSnapshot,
          filesList: rec.filesList || [],
        });
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
  }

  getBackup(id: string): StoredBackupRecord | null {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) return null;
    return this.readJsonFile<StoredBackupRecord | null>(
      path.join(this.backupsDir, `${safeId}.json`),
      null
    );
  }

  listFeedback(): SiteFeedbackItem[] {
    const list = this.readJsonFile<SiteFeedbackItem[]>(
      path.join(this.dataDir, 'feedback.json'),
      []
    );
    return Array.isArray(list) ? list : [];
  }

  saveFeedbackList(items: SiteFeedbackItem[]): void {
    this.writeJsonFile(path.join(this.dataDir, 'feedback.json'), items.slice(0, 300));
  }

  addFeedback(
    entry: Omit<SiteFeedbackItem, 'id' | 'createdAt' | 'visible'>
  ): SiteFeedbackItem {
    const existing = this.listFeedback();
    const record: SiteFeedbackItem = {
      id: `fb_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      createdAt: new Date().toISOString(),
      visible: true,
      pinned: false,
      ...entry,
    };
    this.saveFeedbackList([record, ...existing]);
    return record;
  }

  updateFeedback(
    id: string,
    patch: Partial<Pick<SiteFeedbackItem, 'visible' | 'pinned' | 'adminReply'>>
  ): SiteFeedbackItem | null {
    const existing = this.listFeedback();
    const idx = existing.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    const current = existing[idx];
    const updated: SiteFeedbackItem = {
      ...current,
      ...(typeof patch.visible === 'boolean' ? { visible: patch.visible } : {}),
      ...(typeof patch.pinned === 'boolean' ? { pinned: patch.pinned } : {}),
      ...(typeof patch.adminReply === 'string'
        ? { adminReply: patch.adminReply.trim().slice(0, 400) || undefined }
        : {}),
    };
    existing[idx] = updated;
    this.saveFeedbackList(existing);
    return updated;
  }

  deleteFeedback(id: string): boolean {
    const existing = this.listFeedback();
    const next = existing.filter((item) => item.id !== id);
    if (next.length === existing.length) return false;
    this.saveFeedbackList(next);
    return true;
  }
}

