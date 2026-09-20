import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Empty, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { resolveDisplayName } from "@/hooks/useUserDisplayName";
import { listUsers } from "@/api/users";
import { createKVDatabase, KVConflictError, listKVDatabases, listKVEntries, saveKVEntry, type KVEntry } from "@/api/kv";
import { decodeKVValue, encodeKVValue, initialKVValue, isKVValueDirty, kvJSON, type ValueFormat } from "@/utils/kvValue";
import { base64ToBytes } from "@/utils/text";
import { KVAccessModal } from "@/components/kv/KVAccessModal";
import type { AuthUser } from "@/types";

interface Draft { key: string; entry: KVEntry | null; text: string; format: ValueFormat }
const errorText = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试";

export function RaftDatabasePage() {
  const { token, user, isAdmin } = useAuth();
  return token && user ? <DatabaseWorkspace key={`${token}:${isAdmin}`} token={token} user={user} isAdmin={isAdmin} /> : null;
}

function DatabaseWorkspace({ token, user, isAdmin }: { token: string; user: AuthUser; isAdmin: boolean }) {
  const me = `${user.nodeId}:${user.userId}`;
  const client = useQueryClient();
  const [owner, setOwner] = useState<string | undefined>(isAdmin ? undefined : me);
  const [database, setDatabase] = useState<string>();
  const [dbPickerOpen, setDBPickerOpen] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [appliedPrefix, setAppliedPrefix] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [conflict, setConflict] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newDatabase, setNewDatabase] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const [keyPage, setKeyPage] = useState(1);
  const dirty = !!draft && isKVValueDirty(draft.text, draft.format, draft.entry?.value ?? null);

  const users = useQuery({ queryKey: ["kv-users", token], queryFn: () => listUsers(token), enabled: isAdmin });
  const databases = useQuery({ queryKey: ["kv-databases", token, owner], queryFn: () => listKVDatabases(token, owner!), enabled: !!owner, retry: false });
  const keys = useQuery({ queryKey: ["kv-keys", token, database, appliedPrefix], queryFn: () => listKVEntries(token, database!, appliedPrefix), enabled: !!database, retry: false });
  const userOptions = isAdmin ? (users.data ?? []).map(item => ({
    value: `${item.nodeId}:${item.userId}`,
    label: `${resolveDisplayName(item)} · ${item.nodeId}:${item.userId}`,
    search: `${resolveDisplayName(item)} ${item.username} ${item.loginName} ${item.nodeId}:${item.userId}`.toLowerCase(),
  })) : [{ value: me, label: `${user.username} · ${me}`, search: me }];
  // 自建数据库可以立即定位自己，避免用户列表尚未加载或刷新时丢失选择标签。
  if (isAdmin && !userOptions.some(option => option.value === me)) userOptions.push({ value: me, label: `${user.username}（我） · ${me}`, search: `${user.username} ${me}`.toLowerCase() });

  useEffect(() => { const timer = window.setTimeout(() => setAppliedPrefix(prefix), 250); return () => window.clearTimeout(timer); }, [prefix]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const discardThen = (action: () => void) => {
    if (pending.current) return;
    if (!dirty) { action(); return; }
    Modal.confirm({ title: "放弃未保存的修改？", content: "当前编辑尚未保存。", okText: "放弃修改", cancelText: "继续编辑", onOk: action });
  };
  const resetDraft = () => { setDraft(null); setConflict(""); };
  const selectOwner = (value: string) => discardThen(() => {
    setOwner(value); setDatabase(undefined); setPrefix(""); setAppliedPrefix(""); setKeyPage(1); resetDraft(); setDBPickerOpen(true);
  });
  const selectDatabase = (value: string) => discardThen(() => {
    setDatabase(value); setDBPickerOpen(false); setPrefix(""); setAppliedPrefix(""); setKeyPage(1); resetDraft();
  });
  const openEntry = (key: string, entry: KVEntry) => {
    const value = initialKVValue(entry.value);
    setDraft({ key, entry, ...value }); setConflict("");
  };
  const save = async () => {
    if (!database || !draft || pending.current) return;
    if (!draft.entry && !draft.key) { message.error("请输入键名"); return; }
    let value: string;
    try { value = encodeKVValue(draft.text, draft.format); }
    catch { message.error(draft.format === "json" ? "JSON 格式不正确" : "Base64 格式不正确"); return; }
    pending.current = true; setBusy(true);
    try {
      const revision = await saveKVEntry(token, database, draft.key, value, draft.entry?.modRevision ?? null);
      // 提交成功使用事务返回的版本；不让可能滞后的本地读或后台刷新覆盖草稿。
      setDraft({ ...draft, entry: { value, createRevision: draft.entry?.createRevision ?? revision, modRevision: revision } });
      setConflict(""); message.success(`保存成功 · 版本 ${revision}`);
      void client.invalidateQueries({ queryKey: ["kv-keys", token, database] });
    } catch (error) {
      if (error instanceof KVConflictError) setConflict(error.message);
      else message.error(errorText(error));
    } finally { pending.current = false; setBusy(false); }
  };
  const reload = () => discardThen(() => { void (async () => {
    if (!database || !draft) return;
    pending.current = true; setBusy(true);
    try {
      const result = await listKVEntries(token, database, draft.key);
      const entry = Object.prototype.hasOwnProperty.call(result.items, draft.key) ? result.items[draft.key] : undefined;
      if (!entry) { setConflict("这个键当前不存在。编辑内容已保留，可点击“保留草稿并新建”重新创建或改名保存。"); return; }
      openEntry(draft.key, entry);
    } catch (error) { message.error(errorText(error)); }
    finally { pending.current = false; setBusy(false); }
  })(); });
  const create = async () => {
    if (pending.current || !newDatabase.trim()) return;
    pending.current = true; setBusy(true);
    try {
      const name = newDatabase.trim();
      await createKVDatabase(token, name);
      setOwner(me); setDatabase(name); setDBPickerOpen(false); setPrefix(""); setAppliedPrefix(""); resetDraft(); setCreateOpen(false);
      void client.invalidateQueries({ queryKey: ["kv-databases", token] });
      message.success("数据库已创建");
    } catch (error) { message.error(errorText(error)); }
    finally { pending.current = false; setBusy(false); }
  };
  const changeFormat = (format: ValueFormat) => {
    if (!draft) return;
    try {
      const value = encodeKVValue(draft.text, draft.format);
      const text = decodeKVValue(value, format);
      setDraft({ ...draft, text, format });
    } catch { message.error("内容无法转换到所选格式，请检查当前值"); }
  };
  const rows = Object.entries(keys.data?.items ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => ({ key, entry }));

  return <div className="raft-page">
    <div className="raft-heading"><Typography.Title level={4} style={{ margin: 0 }}>Raft 数据库</Typography.Title>
      <Button icon={<PlusOutlined />} disabled={busy} onClick={() => discardThen(() => { setNewDatabase(""); setCreateOpen(true); })}>新建我的数据库</Button>
    </div>
    <Card size="small" className="raft-selectors"><div className="raft-selector-grid">
      <div className="raft-selector"><Typography.Text>用户</Typography.Text><Select showSearch aria-label="搜索并选择用户" placeholder="搜索用户名、昵称或 ID" value={owner} disabled={!isAdmin || busy} loading={users.isFetching}
        options={userOptions} filterOption={(input, option) => (option?.search ?? "").includes(input.toLowerCase())} onChange={selectOwner} notFoundContent={users.isError ? "用户加载失败" : "没有匹配的用户"} /></div>
      <div className="raft-selector"><Typography.Text>数据库</Typography.Text><Select showSearch aria-label="搜索并选择数据库" placeholder={owner ? "搜索并选择数据库" : "请先选择用户"} value={database} disabled={!owner || busy} loading={databases.isFetching}
        open={dbPickerOpen} onDropdownVisibleChange={setDBPickerOpen} options={(databases.data ?? []).map(item => ({ value: item.name, label: item.name }))}
        filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())} onChange={selectDatabase} notFoundContent={databases.isError ? "数据库加载失败" : "没有匹配的数据库"} />
        <Button aria-label="刷新数据库列表" icon={<ReloadOutlined />} disabled={!owner || busy} loading={databases.isFetching} onClick={() => void databases.refetch()} /></div>
    </div></Card>
    {users.isError && <Alert className="raft-alert" type="error" showIcon message={`用户列表加载失败：${errorText(users.error)}`} action={<Button onClick={() => void users.refetch()}>重试</Button>} />}
    {databases.isError && <Alert className="raft-alert" type="error" showIcon message={errorText(databases.error)} />}
    {!database ? <Card><Empty description={owner ? "请选择该用户的数据库" : "先选择用户，再选择该用户的数据库"} /></Card> : <>
      <div className="raft-context"><Space wrap><Typography.Text strong>{database}</Typography.Text><Typography.Text type="secondary">所有者：{owner}</Typography.Text>{isAdmin && <Tag>系统管理员访问</Tag>}</Space>
        <Button onClick={() => setAccessOpen(true)} disabled={busy}>管理授权</Button></div>
      <div className="raft-workspace">
        <Card size="small" title={`键列表（${rows.length}）`} extra={<Button size="small" icon={<PlusOutlined />} disabled={busy} onClick={() => discardThen(() => {
          setDraft({ key: "", entry: null, text: "{\n  \n}", format: "json" }); setConflict("");
        })}>新增键</Button>}>
          <Space.Compact style={{ width: "100%", marginBottom: 12 }}><Input allowClear aria-label="键名前缀" placeholder="按键名前缀筛选" value={prefix} onChange={e => { setPrefix(e.target.value); setKeyPage(1); }} />
            <Button aria-label="刷新键列表" icon={<ReloadOutlined />} loading={keys.isFetching} onClick={() => void keys.refetch()} /></Space.Compact>
          {keys.isError && <Alert type="error" showIcon message={errorText(keys.error)} />}
          <Table size="small" showHeader={false} loading={keys.isFetching} dataSource={rows} rowKey="key" pagination={{ current: keyPage, pageSize: 12, onChange: setKeyPage, size: "small", showSizeChanger: false }}
            locale={{ emptyText: "没有匹配的键" }} rowClassName={record => record.key === draft?.key && draft.entry ? "raft-key-selected" : ""}
            columns={[{ title: "键", render: (_, record) => <button className="raft-key-button" disabled={busy} onClick={() => discardThen(() => openEntry(record.key, record.entry))}>
              <code>{record.key || "（空键名）"}</code><small>{base64ToBytes(record.entry.value).length} 字节 · 修改版本 {record.entry.modRevision}</small>
            </button> }]} />
        </Card>
        <Card size="small" title={draft?.entry ? "键详情" : draft ? "新增键" : "值编辑器"} extra={draft && <Typography.Text type="secondary">{dirty ? "有未保存的修改" : "未修改"}</Typography.Text>}>
          {!draft ? <Empty description="选择一个键查看详情，或新增一个键" /> : <>
            {draft.entry ? <Typography.Paragraph code copyable className="raft-key-title">{draft.key}</Typography.Paragraph> : <Input aria-label="新键名称" placeholder="键名，例如 config/feature-flags" value={draft.key} disabled={busy} onChange={e => setDraft({ ...draft, key: e.target.value })} style={{ marginBottom: 12 }} />}
            <Space wrap className="raft-meta"><Typography.Text type="secondary">创建版本：{draft.entry?.createRevision ?? "尚未创建"}</Typography.Text><Typography.Text type="secondary">修改版本：{draft.entry?.modRevision ?? "—"}</Typography.Text></Space>
            <div className="raft-value-toolbar"><Typography.Text>值</Typography.Text><Space><Select aria-label="值格式" value={draft.format} disabled={busy} onChange={changeFormat} options={[{ value: "text", label: "文本" }, { value: "json", label: "JSON" }, { value: "base64", label: "Base64" }]} />
              <Button disabled={busy || draft.format !== "json"} onClick={() => { try { setDraft({ ...draft, text: kvJSON.stringify(kvJSON.parse(draft.text), null, 2) }); } catch { message.error("JSON 格式不正确"); } }}>格式化</Button></Space></div>
            <Input.TextArea aria-label="值编辑器" spellCheck={false} value={draft.text} disabled={busy} onChange={e => setDraft({ ...draft, text: e.target.value })} autoSize={{ minRows: 12, maxRows: 24 }} className="raft-value" />
            {conflict && <Alert className="raft-alert" type="warning" showIcon message="保存冲突" description={conflict} action={draft.entry && <Button disabled={busy} onClick={() => { setDraft({ ...draft, entry: null }); setConflict(""); }}>保留草稿并新建</Button>} />}
            <Space wrap style={{ marginTop: 16 }}><Button type="primary" aria-label={draft.entry ? "保存修改" : "创建键"} aria-busy={busy} loading={busy} disabled={!dirty} onClick={() => void save()}>{draft.entry ? "保存修改" : "创建键"}</Button><Button disabled={busy} onClick={reload}>重新读取</Button><Typography.Text type="secondary">{draft.entry ? "保存时校验修改版本" : "仅当键不存在时创建"}</Typography.Text></Space>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>读取当前节点已应用的数据。文本与 JSON 使用 UTF-8，二进制值使用 Base64。</Typography.Paragraph>
          </>}
        </Card>
      </div>
    </>}
    <Modal title="新建我的数据库" open={createOpen} onCancel={() => { if (!busy) setCreateOpen(false); }} onOk={() => void create()} confirmLoading={busy} okButtonProps={{ disabled: !newDatabase.trim() }} cancelButtonProps={{ disabled: busy }} maskClosable={!busy} closable={!busy} keyboard={!busy}>
      <Typography.Paragraph type="secondary">所有者为当前登录用户 {me}，创建后拥有读、写和管理授权权限。数据库名称在集群内唯一。</Typography.Paragraph>
      <Input aria-label="新数据库名称" placeholder="例如 app-config" value={newDatabase} onChange={e => setNewDatabase(e.target.value)} disabled={busy} onPressEnter={() => void create()} />
    </Modal>
    {accessOpen && database && <KVAccessModal token={token} database={database} onClose={() => setAccessOpen(false)} />}
  </div>;
}
