import { Card, Tabs, Table, Tag, Typography, Select } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listClusterNodes, listNodeLoggedInUsers } from "@/api/cluster";
import { REFETCH_INTERVALS } from "@/utils/constants";
import { idToStr } from "@/utils/format";
import { useState } from "react";

const { Title } = Typography;

export function ClusterPage() {
  const { token } = useAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ["clusterNodes"],
    queryFn: () => listClusterNodes(token!),
    enabled: !!token,
    refetchInterval: REFETCH_INTERVALS.Cluster,
  });

  const { data: loggedInUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["loggedInUsers", selectedNodeId],
    queryFn: () => listNodeLoggedInUsers(token!, selectedNodeId!),
    enabled: !!token && !!selectedNodeId,
    refetchInterval: REFETCH_INTERVALS.LoggedInUsers,
  });

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>集群监控</Title>
      <Card>
        <Tabs
          items={[
            {
              key: "nodes",
              label: `集群节点 (${nodes.length})`,
              children: (
                <Table
                  dataSource={nodes}
                  rowKey="nodeId"
                  loading={nodesLoading}
                  pagination={false}
                  columns={[
                    {
                      title: "节点 ID",
                      dataIndex: "nodeId",
                      render: idToStr,
                    },
                    {
                      title: "本地",
                      dataIndex: "isLocal",
                      render: (v: boolean) => (v ? <Tag color="green">本地</Tag> : null),
                    },
                    {
                      title: "配置 URL",
                      dataIndex: "configuredUrl",
                      ellipsis: true,
                    },
                    {
                      title: "来源",
                      dataIndex: "source",
                    },
                    {
                      title: "操作",
                      render: (_, record) => (
                        <a onClick={() => setSelectedNodeId(idToStr(record.nodeId))}>
                          查看在线用户
                        </a>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: "onlineUsers",
              label: "在线用户",
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Select
                      placeholder="选择节点"
                      style={{ width: 200 }}
                      value={selectedNodeId}
                      onChange={setSelectedNodeId}
                      options={nodes.map((n) => ({
                        label: `节点 ${idToStr(n.nodeId)}${n.isLocal ? " (本地)" : ""}`,
                        value: idToStr(n.nodeId),
                      }))}
                    />
                  </div>
                  {selectedNodeId && (
                    <Table
                      dataSource={loggedInUsers}
                      rowKey={(record) => `${record.nodeId}:${record.userId}`}
                      loading={usersLoading}
                      pagination={false}
                      columns={[
                        { title: "节点 ID", dataIndex: "nodeId", render: idToStr },
                        { title: "用户 ID", dataIndex: "userId", render: idToStr },
                        { title: "用户名", dataIndex: "username" },
                      ]}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
