# 普通用户发消息无回显 / 消息只显示一半 — 修复记录

**日期**: 2026-05-07

## 现象

1. 普通用户在聊天页面发送消息后，消息不显示（无回显）
2. HTTP messages 接口返回 12 条数据，但页面只显示 6 条
3. 浏览器控制台报 `Encountered two children with the same key` 警告

## 根因

### `seq` 不是全局唯一的

消息的 `seq` 是**按接收者用户**递增的——每个用户有自己独立的消息序列号。同一条会话中包含两个方向的消息（A→B 和 B→A），不同方向的消息可能拥有相同的 `seq`。

```json
// 两条不同的消息，相同的 (nodeId, seq)
{ "node_id": "7424746513304221", "seq": 1, "sender": 1025, "recipient": 1 }  // 1025→1
{ "node_id": "7424746513304221", "seq": 1, "sender": 1, "recipient": 1025 } // 1→1025
```

### `messageKey()` 只用 `nodeId:seq` → 冲突

`src/utils/format.ts` 中的 `messageKey()` 原来只用 `nodeId` 和 `seq` 构造 key：

```typescript
// 原来
export function messageKey(message: Pick<Message, "nodeId" | "seq">): string {
  return messageKeyStr(message.nodeId, message.seq);
  // 返回 "7424746513304221:1"
}
```

两条不同消息产生相同的 key → `ChatPage.tsx` 三层去重（history / live / sent）把后半部分消息错误地当作重复丢弃。

### React key 同理

`ChatWindow.tsx` 渲染时使用 `${nodeId}-${seq}` 作为 React key，同样冲突。

## 修复

### 1. `format.ts` — `messageKey` 加入 `recipient.userId`

```diff
- export function messageKey(message: Pick<Message, "nodeId" | "seq">): string {
-   return messageKeyStr(message.nodeId, message.seq);
- }
+ export function messageKey(message: Pick<Message, "nodeId" | "seq" | "recipient">): string {
+   return `${idToStr(message.nodeId)}:${idToStr(message.recipient.userId)}:${idToStr(message.seq)}`;
+ }
```

`"7424746513304221:1"` → `"7424746513304221:1:1"` / `"7424746513304221:1025:1"`，冲突消失。

### 2. `ChatPage.tsx` — `chatKey` 同步 + 最终去重安全网

```diff
- const chatKey = (m: Message) => `${m.nodeId}-${m.seq}`;
+ const chatKey = (m: Message) => `${m.nodeId}-${m.recipient.userId}-${m.seq}`;
```

同时在 `all` 数组计算后追加了基于 `chatKey` 的 Map 最终去重，防止 history / live / sent 三个来源出现相同消息时产生 React duplicate key 警告。

## 涉及文件

| 文件 | 改动 |
|---|---|
| `src/utils/format.ts` | `messageKey()` 签名和实现 |
| `src/pages/ChatPage.tsx` | `chatKey` 定义 + `all` 数组最终去重 |
| `src/utils/realtimeCredentials.test.ts` | 测试断言更新 |

## 验证

- `tsc --noEmit` 通过
- `vitest run` 通过
