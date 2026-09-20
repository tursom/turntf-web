// RAFT_TEST_URL=http://127.0.0.1:5186 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node src/components/kv/raft.browser.mjs
// 使用真实 React / Ant Design / KV HTTP 封装，仅替换认证和 HTTP 数据。
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.RAFT_TEST_URL || 'http://127.0.0.1:5186';
const transformed = await (await fetch(`${base}/src/pages/RaftDatabasePage.tsx`)).text();
const dep = name => {
  const match = transformed.match(new RegExp(`"([^"\\n]*\\/${name}\\.js[^"\\n]*)"`));
  if (!match) throw new Error(`Missing dependency: ${name}`);
  return match[1];
};
const react = dep('react');
const query = dep('@tanstack_react-query');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error); });
    let revision = 9007199254740993n;
    let value = Buffer.from('{"enabled":true}').toString('base64');
    let conflict = true;
    let deleted = false;
    const acl = { '1:10': 7 };
    const transactions = [];
    await page.route('**/src/hooks/useAuth.ts*', route => route.fulfill({ contentType: 'application/javascript', body: `export const useAuth=()=>({token:'test',isAdmin:true,user:{nodeId:'1',userId:'1',username:'root'}});` }));
    await page.route('**/api/**', route => {
      const req = route.request(), url = new URL(req.url());
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let data;
      if (url.pathname === '/api/users') data = [{ node_id: 1, user_id: 10, username: 'alice', profile: { display_name: '产品应用' } }, { node_id: 1, user_id: 20, username: 'bob', profile: {} }];
      else if (url.pathname === '/api/kv/databases') data = { items: url.searchParams.get('owner') === '1:10' ? [{ name: 'app-config', owner: '1:10' }, { name: 'feature-config', owner: '1:10' }] : [], revision: 42 };
      else if (url.pathname.endsWith('/list')) {
        if (deleted) return route.fulfill({ json: { revision: 42, items: {} } });
        return route.fulfill({ contentType: 'application/json', body: `{"revision":${revision},"items":{"config/flags":{"value":"${value}","create_revision":1,"mod_revision":${revision}}}}` });
      } else if (url.pathname.endsWith('/txn')) {
        const raw = req.postData(); transactions.push(raw);
        if (conflict || (deleted && raw.includes('"exists":true'))) { conflict = false; return route.fulfill({ json: { Succeeded: false, Revision: 42 } }); }
        deleted = false;
        value = JSON.parse(raw).puts[0].value; revision++;
        return route.fulfill({ contentType: 'application/json', body: `{"Succeeded":true,"Revision":${revision}}` });
      } else if (url.pathname.endsWith('/acl')) data = { database: { name: 'app-config', owner: '1:10', acl, permission: 7 }, revision: 42 };
      else if (url.pathname.includes('/acl/')) {
        const subject = decodeURIComponent(url.pathname.split('/').at(-1));
        if (req.method() === 'DELETE') delete acl[subject]; else acl[subject] = req.postDataJSON().permission;
        data = { Succeeded: true, Revision: 43 };
      } else return route.fulfill({ status: 404, json: { error: 'unexpected mock endpoint' } });
      return route.fulfill({ json: data });
    });
    await page.route('**/raft-test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"></head><body style="padding:16px"><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      const React=(await import('${react}')).default;
      const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const {QueryClient,QueryClientProvider}=await import('${query}');
      const {RaftDatabasePage}=await import('/src/pages/RaftDatabasePage.tsx');
      createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},React.createElement(RaftDatabasePage)));
    </script></body></html>` }));
    await page.goto(`${base}/raft-test`);
    const users = page.getByRole('combobox', { name: '搜索并选择用户' });
    const databases = page.getByRole('combobox', { name: '搜索并选择数据库' });
    assert.equal(await databases.isDisabled(), true);
    await users.fill('产品');
    await page.locator('.ant-select-item-option').filter({ hasText: '产品应用' }).click();
    await databases.fill('app');
    await page.locator('.ant-select-item-option').filter({ hasText: 'app-config' }).click();
    await page.getByRole('button', { name: /config\/flags/ }).click();
    await page.getByRole('textbox', { name: '值编辑器' }).fill('{"enabled":false}');
    await page.getByRole('button', { name: '保存修改' }).click();
    await page.getByText('保存冲突', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '值编辑器' }).inputValue(), '{"enabled":false}');
    await page.getByRole('button', { name: '保存修改' }).click();
    await page.getByText('未修改', { exact: true }).waitFor();
    assert(transactions[1].includes('"revision":9007199254740993'));
    await page.getByRole('button', { name: '管理授权' }).click();
    await page.getByRole('textbox', { name: '授权用户' }).fill('1:20');
    await page.getByRole('button', { name: '保存授权' }).click();
    await page.getByRole('cell', { name: '1:20', exact: true }).waitFor();
    assert.equal(acl['1:20'], 1);
    await page.locator('.ant-modal-close').click();
    await page.getByRole('textbox', { name: '值编辑器' }).fill('{"recover":true}');
    deleted = true;
    await page.getByRole('button', { name: '保存修改' }).click();
    await page.getByText('保存冲突', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新读取' }).click();
    await page.getByRole('button', { name: '放弃修改' }).click();
    await page.getByText(/这个键当前不存在/).waitFor();
    await page.getByRole('button', { name: '保留草稿并新建' }).click();
    assert.equal(await page.getByRole('textbox', { name: '新键名称' }).inputValue(), 'config/flags');
    assert.equal(await page.getByRole('textbox', { name: '值编辑器' }).inputValue(), '{"recover":true}');
    await page.getByRole('button', { name: '创建键', exact: true }).click();
    await page.getByText('未修改', { exact: true }).waitFor();
    assert(transactions.at(-1).includes('"exists":false'));
    await page.getByRole('textbox', { name: '值编辑器' }).fill('{"draft":true}');
    await users.fill('bob'); await page.locator('.ant-select-item-option').filter({ hasText: 'bob' }).click();
    await page.locator('.ant-modal-confirm-title').filter({ hasText: '放弃未保存的修改？' }).waitFor();
    await page.getByRole('button', { name: '继续编辑' }).click();
    assert.equal(await page.getByRole('textbox', { name: '值编辑器' }).inputValue(), '{"draft":true}');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `/tmp/turntf-raft-${width}.png` });
    await users.fill('bob'); await page.locator('.ant-select-item-option').filter({ hasText: 'bob' }).click();
    await page.getByRole('button', { name: '放弃修改' }).click();
    await page.getByText('请选择该用户的数据库', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '值编辑器' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: user/database search, CAS conflict and deletion recovery, precise revision, ACL, dirty draft, selection reset, no overflow`);
    await page.close();
  }
} finally { await browser.close(); }
