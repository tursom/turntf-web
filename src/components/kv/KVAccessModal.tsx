import { useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, Popconfirm, Space, Table, Typography, message } from "antd";
import { useQuery } from "@tanstack/react-query";
import { getKVAccess, grantKVAccess, normalizeKVPrincipal, revokeKVAccess } from "@/api/kv";

export function KVAccessModal({ token, database, onClose }: { token: string; database: string; onClose: () => void }) {
  const [principal, setPrincipal] = useState("");
  const [permissions, setPermissions] = useState<number[]>([1]);
  const [busy, setBusy] = useState(false);
  const access = useQuery({ queryKey: ["kv-access", token, database], queryFn: () => getKVAccess(token, database), retry: false });
  const update = async (subject: string, permission?: number) => {
    if (busy) return;
    setBusy(true);
    try {
      if (permission === undefined) await revokeKVAccess(token, database, subject);
      else await grantKVAccess(token, database, subject, permission);
      message.success("授权变更已提交");
      await access.refetch();
    } catch (error) { message.error(error instanceof Error ? error.message : "授权操作失败"); }
    finally { setBusy(false); }
  };
  return <Modal title={`授权管理 · ${database}`} open onCancel={() => { if (!busy) onClose(); }} footer={null} width={640} maskClosable={!busy} closable={!busy} keyboard={!busy}>
    <Typography.Paragraph type="secondary">所有者：{access.data?.owner ?? "加载中"}。系统管理员可直接管理，授权变更不改变所有权。</Typography.Paragraph>
    {access.isError && <Alert type="error" showIcon message={access.error.message} action={<Button onClick={() => void access.refetch()}>重试</Button>} />}
    <Table size="small" loading={access.isFetching} pagination={{ pageSize: 5 }} rowKey="subject" scroll={{ x: 440 }}
      dataSource={Object.entries(access.data?.acl ?? {}).map(([subject, permission]) => ({ subject, permission }))}
      columns={[
        { title: "用户", dataIndex: "subject", render: (value: string) => value === "*" ? "所有用户（*）" : value },
        { title: "权限", dataIndex: "permission", render: (value: number) => [[1, "读"], [2, "写"], [4, "管理授权"]].filter(([bit]) => value & Number(bit)).map(([, text]) => text).join("、") || "无" },
        { title: "操作", render: (_, record) => <Space>
          <Button size="small" disabled={busy} onClick={() => { setPrincipal(record.subject); setPermissions([1, 2, 4].filter(bit => record.permission & bit)); }}>编辑</Button>
          <Popconfirm title={`撤销 ${record.subject} 的授权？`} onConfirm={() => update(record.subject)} disabled={busy}><Button size="small" danger disabled={busy}>撤销</Button></Popconfirm>
        </Space> },
      ]} />
    <Space direction="vertical" style={{ width: "100%", marginTop: 16 }}>
      <Typography.Text>授权用户（节点 ID:用户 ID，或 * 表示所有用户）</Typography.Text>
      <Input aria-label="授权用户" value={principal} onChange={e => setPrincipal(e.target.value)} disabled={busy || !access.data} placeholder="例如 1:1001" />
      <Checkbox.Group value={permissions} onChange={values => setPermissions(values as number[])} disabled={busy || !access.data} options={[{ label: "读", value: 1 }, { label: "写", value: 2 }, { label: "管理授权", value: 4 }]} />
      <Button type="primary" loading={busy} disabled={!access.data || access.isError} onClick={() => {
        let subject: string;
        try { subject = normalizeKVPrincipal(principal); }
        catch (error) { message.error(error instanceof Error ? error.message : "授权用户格式错误"); return; }
        setPrincipal(subject);
        if (!permissions.length) { message.error("请选择权限；取消所有权限请使用撤销"); return; }
        void update(subject, permissions.reduce((bits, bit) => bits | bit, 0));
      }}>保存授权</Button>
    </Space>
  </Modal>;
}
