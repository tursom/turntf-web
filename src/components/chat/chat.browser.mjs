// 运行：CHAT_TEST_URL=http://127.0.0.1:5175 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node src/components/chat/chat.browser.mjs
// 使用真实页面与 Antd；仅替换网络、认证和会话列表数据来源。
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.CHAT_TEST_URL || "http://127.0.0.1:5175";
const transformed = await (await fetch(`${base}/src/pages/ChatPage.tsx`)).text();
const dependency = (name) => {
  const match = transformed.match(new RegExp(`"([^"\\n]*\\/${name}\\.js[^"\\n]*)"`));
  if (!match) throw new Error(`缺少 Vite 依赖：${name}`);
  return `${base}${match[1]}`;
};
const react = dependency("react");
const router = dependency("react-router-dom");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
    const mock = (path, body) => page.route(`**/src/${path}*`, (route) => route.fulfill({ contentType: "application/javascript", body }));
    await mock("hooks/useAuth.ts", `export const useAuth = () => ({token:'test', user:{nodeId:'1',userId:'10'}});`);
    await mock("hooks/useUserDisplayName.ts", `export const useUserDisplayName = () => ({getUserDisplayName: target => '会话 ' + target.userId});`);
    await mock("hooks/useChat.ts", `import React from '${react}';
      window.receipts = []; window.live = [];
      export function useChat() {
        const [messages, setMessages] = React.useState(window.live);
        window.pushMessage = message => { window.live = [...window.live, message]; setMessages(window.live); };
        return {connected:true, messages, statusText:null, sendMessage:(target,body) => new Promise((resolve,reject) => window.receipts.push({target,body,resolve,reject}))};
      }`);
    await mock("api/messages.ts", `window.historyRequests = []; export const listMessages = (...args) => new Promise((resolve,reject) => window.historyRequests.push({args,resolve,reject}));`);
    await mock("components/chat/ConversationList.tsx", `import React from '${react}'; export function ConversationList({onSelect}) {return React.createElement('div', {'aria-label':'会话列表'}, ['20','30'].map(userId=>React.createElement('button',{key:userId,onClick:()=>onSelect({nodeId:'1',userId})},'选择 '+userId)));}`);
    await page.route("**/chat-test", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:${width < 768 ? 12 : 24}px;padding-top:${width < 768 ? 68 : 80}px;box-sizing:border-box"><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('${react}')).default;
      const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const {BrowserRouter, Routes, Route} = await import('${router}');
      const {ChatPage} = await import('/src/pages/ChatPage.tsx');
      history.replaceState({}, '', '/chat');
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Routes,null,React.createElement(Route,{path:'/chat',element:React.createElement(ChatPage)}),React.createElement(Route,{path:'/chat/:nodeId/:userId',element:React.createElement(ChatPage)}))));
      window.makeMessage = (seq, peer='20') => ({nodeId:'1',seq:String(seq),sender:{nodeId:'1',userId:peer},recipient:{nodeId:'1',userId:'10'},body:new TextEncoder().encode(peer+' 消息 '+seq),createdAtHlc:'1000-0'});
    </script></body></html>` }));
    await page.goto(`${base}/chat-test`);
    await page.getByRole("button", { name: "选择 20" }).click();
    await page.getByRole("status").waitFor();
    await page.getByRole("textbox", { name: "消息草稿" }).fill("草稿 A");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    const select = async (id) => {
      if (width < 768) await page.getByRole("button", { name: "返回会话列表" }).click();
      await page.getByRole("button", { name: `选择 ${id}` }).click();
      await page.waitForURL(`**/chat/1/${id}`);
      await page.getByText(`会话 ${id}`, { exact: true }).first().waitFor();
    };
    await select("30");
    await page.getByRole("textbox").fill("草稿 B");
    await page.waitForFunction(() => window.historyRequests.some(r => r.args[5] === '30'));
    await page.evaluate(() => {
      window.historyRequests.find(r => r.args[5] === '30').resolve([window.makeMessage(300, '30')]);
      window.historyRequests.find(r => r.args[5] === '20').resolve([window.makeMessage(200)]);
      window.receipts[0].resolve({...window.makeMessage(201),sender:{nodeId:'1',userId:'10'},recipient:{nodeId:'1',userId:'20'}});
    });
    await page.getByText("30 消息 300", { exact: true }).waitFor();
    assert.equal(await page.getByText("20 消息 200", { exact: true }).count(), 0);
    assert.equal(await page.getByText("20 消息 201", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("textbox").inputValue(), "草稿 B");
    await select("20");
    assert.equal(await page.getByRole("textbox").inputValue(), "");
    await page.evaluate(() => window.historyRequests.at(-1).reject(new Error('failed')));
    await page.getByText("历史消息加载失败", { exact: true }).waitFor();
    await page.getByRole("button", { name: "重试" }).click();
    await page.evaluate(() => window.historyRequests.at(-1).resolve(Array.from({length:50}, (_,i)=>window.makeMessage(50-i))));
    await page.getByText("20 消息 50", { exact: true }).waitFor();
    const region = page.getByRole("region", { name: "聊天消息" });
    await page.waitForFunction(() => {const el=document.querySelector('[aria-label="聊天消息"]');return el.scrollHeight-el.clientHeight-el.scrollTop<2;});
    await region.evaluate(el => {el.scrollTop = 0; el.dispatchEvent(new Event('scroll'));});
    await page.getByRole("textbox").fill("滚动不应变化");
    assert.ok(await region.evaluate(el => el.scrollTop <= 2));
    await page.evaluate(() => window.pushMessage(window.makeMessage(51)));
    await page.getByRole("button", { name: "1 条新消息" }).waitFor();
    assert.ok(await region.evaluate(el => el.scrollTop <= 2));
    await page.getByRole("button", { name: "1 条新消息" }).click();
    await page.waitForFunction(() => {const el=document.querySelector('[aria-label="聊天消息"]');return el.scrollHeight-el.clientHeight-el.scrollTop<2;});
    await page.evaluate(() => window.pushMessage(window.makeMessage(52)));
    await page.waitForFunction(() => {const el=document.querySelector('[aria-label="聊天消息"]');return el.scrollHeight-el.clientHeight-el.scrollTop<2;});
    assert.equal(await page.getByRole("button", { name: /条新消息/ }).count(), 0);
    await region.evaluate(el => {el.scrollTop = 0; el.dispatchEvent(new Event('scroll'));});
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await page.waitForFunction(() => {const el=document.querySelector('[aria-label="聊天消息"]');return el.scrollHeight-el.clientHeight-el.scrollTop<2;});
    await page.evaluate(() => window.receipts.at(-1).reject(new Error('测试发送失败')));
    await page.getByText("发送失败：测试发送失败", { exact: true }).waitFor();
    assert.equal(await page.getByRole("textbox").inputValue(), "滚动不应变化");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok(await page.getByRole('textbox').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight));
    if (width < 768) assert.equal(await page.getByRole("button", { name: "选择 30" }).isVisible(), false);
    await page.screenshot({ path: `/tmp/turntf-chat-${width}.png` });
    await select("30");
    assert.equal(await page.getByRole("textbox").inputValue(), "草稿 B");
    const receiptsBeforeComposition = await page.evaluate(() => window.receipts.length);
    await page.getByRole("textbox").dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229, isComposing: true });
    assert.equal(await page.evaluate(() => window.receipts.length), receiptsBeforeComposition);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: 会话隔离、草稿、历史重试、滚动、发送失败、布局`);
    await page.close();
  }
} finally {
  await browser.close();
}
