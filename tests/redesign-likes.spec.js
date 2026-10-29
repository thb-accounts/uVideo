import { test, expect } from '@playwright/test'

const base = 'http://127.0.0.1:5173'

test('home, categories, mobile search and watch navigation', async ({ page }) => {
  await page.goto(base)
  await expect(page.getByRole('heading', { name: 'Fresh finds' })).toBeVisible()
  await expect(page.locator('.video-card').first()).toBeVisible()
  await page.getByRole('navigation', { name: 'Video categories' }).getByRole('link', { name: 'Coding', exact: true }).click()
  await expect(page.locator('.video-card')).toHaveCount(2)
  await page.setViewportSize({ width: 390, height: 844 })
  const search = page.getByRole('searchbox', { name: 'Search videos' })
  await expect(search).toBeVisible()
  await search.fill('missing-video')
  await page.getByRole('button', { name: 'Submit search' }).click()
  await expect(page).toHaveURL(/search=missing-video/)
  await expect(page.getByRole('heading', { name: 'Results for “missing-video”' })).toBeVisible()
  await page.goto(base)
  await page.locator('.video-card').first().click()
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Like', exact: true }).click()
  await expect(page).toHaveURL(/auth/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

async function likeHarness(page) {
  // Use the real hook + API implementation, replacing only its database transport.
  await page.route('**/src/lib/supabase.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const hasSupabaseConfig = true;
    export const supabase = { from() {
      const op = { action:'read', filters:{} };
      const q = {
        select(_, options) { op.head=options?.head; return q },
        eq(key,value) { op.filters[key]=value; return q },
        maybeSingle() { return q },
        upsert(row) { op.action='insert'; op.row=row; return q },
        delete() { op.action='delete'; return q },
        then(resolve) { setTimeout(() => {
          window.writes = window.writes || 0;
          const saved = localStorage.getItem('test-liked') === 'yes';
          if (op.action !== 'read') {
            window.writes++;
            if(window.failWrite) return resolve({error:{message:'permission denied'}});
            localStorage.setItem('test-liked',op.action==='insert'?'yes':'no');
          }
          resolve({data: op.head?null:(saved?{user_id:'test-user'}:null),count:saved?4:3,error:null});
        }, 120) }
      }; return q;
    }};
  ` }))
  await page.route('**/__likes', route => route.fulfill({ contentType: 'text/html', body: `<div id="root"></div><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import {createRoot} from '/node_modules/.vite/deps/react-dom_client.js';
    import {MemoryRouter} from '/node_modules/.vite/deps/react-router-dom.js';
    import {AuthContext} from '/src/context/auth-context.js';
    import {useContentLike} from '/src/hooks/useContentLike.js';
    function Test(){const s=useContentLike('test-content');return React.createElement('div',null,
      React.createElement('button',{onClick:s.toggleLike,disabled:s.likeDisabled,'aria-pressed':s.liked},String(s.likeCount)),
      s.likeError && React.createElement('p',{role:'alert'},s.likeError));}
    createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,
      React.createElement(AuthContext.Provider,{value:{user:{id:'test-user'}}},React.createElement(Test))));
  </script>` }))
  await page.goto(`${base}/__likes`)
  await expect(page.getByRole('button')).toBeEnabled()
}

test('likes persist after reload, unlike persists, rapid clicks write once', async ({ page }) => {
  await likeHarness(page)
  const button = page.getByRole('button')
  await expect(button).toHaveText('3')
  await button.evaluate(el => { el.click(); el.click(); el.click() })
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(button).toBeEnabled()
  expect(await page.evaluate(() => window.writes)).toBe(1)
  await page.reload()
  await expect(button).toHaveText('4')
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await button.click()
  await expect(button).toBeEnabled()
  await page.reload()
  await expect(button).toHaveText('3')
  await expect(button).toHaveAttribute('aria-pressed', 'false')
})

test('failed writes restore the count and state and display an error', async ({ page }) => {
  await likeHarness(page)
  await page.evaluate(() => { window.failWrite = true })
  await page.getByRole('button').click()
  await expect(page.getByRole('alert')).toContainText('could not be saved')
  await expect(page.getByRole('button')).toHaveText('3')
  await expect(page.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
})
