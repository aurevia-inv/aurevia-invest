import {randomUUID} from 'node:crypto';
import {io} from 'socket.io-client';
import {test,expect,loginAs,expectNoHorizontalOverflow} from './fixtures';

const viewports=[
	{width:320,height:800},
	{width:390,height:844},
	{width:768,height:1024},
	{width:1440,height:900},
];

const publicRoutes=['/','/login','/register','/markets','/about','/education','/support','/terms','/privacy','/risk-disclosure'];
const authenticatedRoutes=['/dashboard','/trade','/wallet','/wallet/transactions','/kyc','/settings','/support','/notifications'];
const adminRoutes=['/admin/login','/admin','/admin/payments','/admin/support'];

function fixture(name:string){
	const value=process.env[`AUREVIA_E2E_${name}`];
	if(!value)throw new Error(`Playwright fixture ${name} is unavailable.`);
	return value;
}

test.describe('public routes and responsive layout',()=>{
	for(const viewport of viewports){
		test(`public routes render without horizontal overflow at ${viewport.width}x${viewport.height}`,async({page})=>{
			await page.setViewportSize(viewport);
			for(const route of publicRoutes){
				const response=await page.goto(route);
				expect(response?.status(),route).toBe(200);
				await expect(page.locator('h1').first(),route).toBeVisible();
				if(route==='/markets')await expect(page.getByRole('heading',{name:'LIVE MARKET ACTIVITY'})).toBeVisible();
				if(route==='/support')await expect(page.getByRole('heading',{name:'Nova AI',exact:true})).toBeVisible();
				if(route==='/register'){
					await expect(page.getByRole('radio',{name:/DEMO ACCOUNT/})).toBeVisible();
					await expect(page.getByRole('radio',{name:/REAL ACCOUNT/})).toBeVisible();
				}
				await expectNoHorizontalOverflow(page);
			}
		});
	}
});

test('mobile navigation opens and navigates to Login',async({page})=>{
	await page.setViewportSize({width:320,height:800});
	await page.goto('/');
	await page.getByRole('button',{name:'Open navigation'}).click();
	const nav=page.getByRole('navigation',{name:'Primary navigation'});
	await expect(nav).toBeVisible();
	await nav.getByRole('link',{name:'Login'}).click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole('heading',{name:'Sign in'})).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test('registration selects account mode, verifies through delivery, then login persists until logout',async({page})=>{
	const email=fixture('REGISTRATION_EMAIL');
	const password=fixture('REGISTRATION_PASSWORD');
	await page.goto('/register');
	await expect(page.getByRole('heading',{name:'Open an account'})).toBeVisible();
	await expect(page.getByRole('radio',{name:/DEMO ACCOUNT/})).toBeVisible();
	const realMode=page.getByRole('radio',{name:/REAL ACCOUNT/});
	await realMode.check();
	await expect(realMode).toBeChecked();
	await page.getByLabel('Full name').fill('Temporary Browser Test');
	await page.getByLabel('Email', {exact:true}).fill(email);
	await page.getByLabel('Country').fill('Test');
	await page.getByLabel('Phone (optional)').fill('+12105550199');
	await page.getByLabel('Password', {exact:true}).fill(password);
	await page.getByRole('checkbox').check();
	await page.getByRole('button',{name:'Continue to verification'}).click();
	await expect(page.getByRole('heading',{name:'Verify your account'})).toBeVisible();
	const unverifiedLogin=await page.context().newPage();
	await unverifiedLogin.goto('/login');
	await unverifiedLogin.getByLabel('Email or administrator username').fill(email);
	await unverifiedLogin.getByLabel('Password').fill(password);
	await unverifiedLogin.getByRole('button',{name:'Sign in'}).click();
	await expect(unverifiedLogin.getByText('Invalid credentials or inactive account.',{exact:true})).toBeVisible();
	await unverifiedLogin.close();
	const codeResponse=await page.request.get(`http://127.0.0.1:4311/test-code?email=${encodeURIComponent(email)}`);
	expect(codeResponse.ok()).toBeTruthy();
	const code=(await codeResponse.json()).code as string;
	const invalidCode=code==='000000'?'000001':'000000';
	await page.getByLabel('Verification code').fill(invalidCode);
	await page.getByRole('button',{name:'Verify account'}).click();
	await expect(page.getByText('The code is incorrect.',{exact:true})).toBeVisible();
	await page.getByLabel('Verification code').fill(code);
	await page.getByRole('button',{name:'Verify account'}).click();
	await expect(page).toHaveURL(/\/login\?verified=1/);
	await expect(page.getByText('Your account is verified. Sign in to continue.',{exact:true})).toBeVisible();
	await page.getByLabel('Email or administrator username').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button',{name:'Sign in'}).click();
	await page.waitForURL(/dashboard/);
	await page.goto('/');
	await expect(page.getByRole('link',{name:/Dashboard/}).first()).toBeVisible();
	await expect(page.getByRole('button',{name:/Notifications/})).toBeVisible();
	await expect(page.getByRole('link',{name:'Login'})).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole('button',{name:/Notifications/})).toBeVisible();
	await page.getByRole('button',{name:'Logout'}).click();
	await expect(page).toHaveURL(/\/login/);
	await page.goto('/');
	await expect(page.getByRole('link',{name:'Login'})).toBeVisible();
	await expect(page.getByRole('link',{name:'Open an account'}).first()).toBeVisible();
});

test('legacy account without registration verification metadata can still sign in',async({page})=>{
	await loginAs(page,fixture('LEGACY_USER_EMAIL'),fixture('LEGACY_USER_PASSWORD'));
	await expect(page.getByRole('heading',{name:'Good to see you.'})).toBeVisible();
	await expect(page.getByRole('button',{name:/Notifications/})).toBeVisible();
});

test('authenticated routes render at mobile, tablet, and desktop sizes',async({page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	for(const viewport of viewports){
		await page.setViewportSize(viewport);
		for(const route of authenticatedRoutes){
			const response=await page.goto(route);
			expect(response?.status(),route).toBe(200);
			await expect(page.locator('h1').first(),route).toBeVisible();
			await expectNoHorizontalOverflow(page);
		}
	}
});

test('notifications bell, unread state, mark one/all, and history persist',async({page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	await page.goto('/');
	const bell=page.getByRole('button',{name:/Notifications/});
	await expect(bell).toContainText(/\d/);
	await bell.click();
	await expect(page.getByRole('dialog',{name:'Notifications'})).toBeVisible();
	const first=page.locator('.notification-row').filter({hasText:'E2E unread notification one'});
	await expect(first).toBeVisible();
	await first.click();
	await bell.click();
	await page.getByRole('button',{name:'Mark all notifications as read'}).click();
	await expect(page.locator('.notification-count')).toHaveCount(0);
	await page.goto('/notifications');
	await expect(page.getByRole('heading',{name:'Notifications'})).toBeVisible();
	await expect(page.getByText('All caught up')).toBeVisible();
	await page.reload();
	await expect(page.getByText('All caught up')).toBeVisible();
	await expectNoHorizontalOverflow(page);
});

test('account-mode changes refresh and isolate wallet, trade, history, and support state',async({page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	const mode=page.getByLabel('Account mode');
	await page.goto('/wallet');
	await expect(page.getByText('DEMO ACCOUNT',{exact:true}).last()).toBeVisible();
	await mode.selectOption('REAL');
	await expect(page.getByText('REAL ACCOUNT',{exact:true}).last()).toBeVisible();
	await expect(page.locator('.wallet-balance-value')).toHaveText('0.00 USD');
	const instrumentsResponse=await page.request.get('/api/market');
	const instruments=await instrumentsResponse.json();
	const realOrderResponse=await page.request.post('/api/orders',{data:{instrumentId:instruments[0].id,side:'BUY',type:'MARKET',quantity:1}});
	expect(realOrderResponse.status()).toBe(400);
	expect((await realOrderResponse.json()).error).toContain('REAL_EXECUTION_UNAVAILABLE');
	await page.goto('/wallet/transactions');
	await expect(page.locator('.account-heading .status-pill')).toContainText('REAL ACCOUNT');
	await expect(page.getByText('No transactions yet')).toBeVisible();
	await mode.selectOption('DEMO');
	await expect(page.locator('.account-heading .status-pill')).toContainText('DEMO ACCOUNT');
	await page.goto('/trade');
	await mode.selectOption('REAL');
	await expect(page.getByRole('button',{name:'REAL trading unavailable'})).toBeDisabled();
	await mode.selectOption('DEMO');
	await expect(page.getByRole('button',{name:'Place BUY order'})).toBeEnabled();
	await page.goto('/support');
	await page.getByRole('button',{name:'Contact Admin'}).click();
	const subject=`Mode-scoped support ${randomUUID().slice(0,8)}`;
	await page.getByLabel('Subject').fill(subject);
	await page.getByLabel('Message').fill('Temporary DEMO support isolation test.');
	await page.getByRole('button',{name:'Create support ticket'}).click();
	await expect(page.getByRole('button').filter({hasText:subject})).toBeVisible();
	await mode.selectOption('REAL');
	await expect(page.getByRole('button').filter({hasText:subject})).toHaveCount(0);
	await mode.selectOption('DEMO');
	await expect(page.getByRole('button').filter({hasText:subject})).toBeVisible();
});

test('DEMO trading chart and order produce recorded simulated marketplace activity',async({page})=>{
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	const symbol=fixture('INSTRUMENT_B');
	await page.goto('/markets');
	await expect(page.getByRole('heading',{name:'LIVE MARKET ACTIVITY'})).toBeVisible();
	await expect(page.getByText('Live connection')).toBeVisible();
	const marketPageUrl=page.url();
	const socket=io('http://127.0.0.1:4310',{autoConnect:false,reconnection:false,timeout:5000});
	const socketExecutions:Array<{symbol:string;side:string;accountMode:string}> = [];
	socket.on('trade:update',events=>socketExecutions.push(...events.filter((event:{symbol:string;side:string;accountMode:string})=>event.symbol===symbol&&event.side==='BUY'&&event.accountMode==='DEMO')));
	const tradePage=await page.context().newPage();
	try{
		await new Promise<void>((resolve,reject)=>{
			const timer=setTimeout(()=>reject(new Error('Socket.IO connection timed out.')),10000);
			socket.once('connect',()=>{clearTimeout(timer);resolve()});
			socket.once('connect_error',error=>{clearTimeout(timer);reject(error)});
			socket.connect();
		});
		await tradePage.goto('/trade');
		const instrument=tradePage.getByRole('button',{name:new RegExp(symbol.replace('/','\\/'))});
		await expect(instrument).toBeVisible();
		await instrument.click();
		await expect(tradePage.locator('.recharts-surface').first()).toBeVisible();
		await expect(tradePage.getByText('Internal simulated market')).toBeVisible();
		const orderResponsePromise=tradePage.waitForResponse(response=>response.url().endsWith('/api/orders')&&response.request().method()==='POST');
		await tradePage.getByRole('button',{name:'Place BUY order'}).click();
		await expect(tradePage.getByRole('status')).toContainText('Order accepted');
		const orderResponse=await orderResponsePromise;
		expect(orderResponse.ok()).toBeTruthy();
		const order=await orderResponse.json();
		expect(order.status).toBe('FILLED');
		expect(order.executions).toHaveLength(1);
		const event=page.locator('.market-activity-item').filter({hasText:symbol});
		await expect(event).toBeVisible();
		await expect(event.getByText('Demo · simulated')).toBeVisible();
		expect(page.url()).toBe(marketPageUrl);
		await expect(event).toHaveCount(1);
		await page.waitForTimeout(2500);
		expect(socketExecutions).toHaveLength(1);
		await page.getByLabel('Account mode').selectOption('REAL');
		await expect(page.getByText('No real execution records are available for this account.')).toBeVisible();
		await expect(page.locator('.market-activity-item')).toHaveCount(0);
		await expectNoHorizontalOverflow(page);
	}finally{
		socket.disconnect();
		if(!tradePage.isClosed())await tradePage.close();
	}
});

test('Nova escalation reaches admin and admin response appears with notification',async({page})=>{
	const subject=`E2E support ${randomUUID().slice(0,8)}`;
	const reply='Temporary Playwright admin response.';
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	await page.goto('/support');
	await expect(page.getByRole('heading',{name:'Nova AI',exact:true})).toBeVisible();
	await expect(page.getByRole('link',{name:/nftsinvestmentplc@gmail.com/})).toBeVisible();
	await page.getByRole('button',{name:'Contact Admin'}).click();
	await page.getByLabel('Subject').fill(subject);
	await page.getByLabel('Message').fill('Please review this disposable browser test ticket.');
	await page.getByRole('button',{name:'Create support ticket'}).click();
	await expect(page.getByRole('status')).toContainText(/sent to the admin inbox/i);
	await page.getByRole('button',{name:'Logout'}).click();
	await expect(page).toHaveURL(/\/login/);
	await loginAs(page,fixture('ADMIN_EMAIL'),fixture('ADMIN_PASSWORD'));
	await page.goto('/admin/support');
	await page.getByRole('button',{name:new RegExp(subject)}).click();
	await page.getByLabel('Admin response').fill(reply);
	await page.getByRole('button',{name:'Send response'}).click();
	await expect(page.getByRole('status')).toContainText('Response sent to the user');
	await page.getByRole('button',{name:'Logout'}).click();
	await loginAs(page,fixture('USER_EMAIL'),fixture('USER_PASSWORD'));
	await page.goto('/notifications');
	await expect(page.getByText('Admin replied to your support ticket')).toBeVisible();
	await page.goto('/support');
	const ticket=page.getByRole('button').filter({hasText:subject});
	await ticket.click();
	await expect(page.getByText(reply)).toBeVisible();
});

test('admin pages render for authenticated administrator at requested viewports',async({page})=>{
	await loginAs(page,fixture('ADMIN_EMAIL'),fixture('ADMIN_PASSWORD'));
	for(const viewport of viewports){
		await page.setViewportSize(viewport);
		for(const route of adminRoutes){
			const response=await page.goto(route);
			expect(response?.status(),route).toBe(200);
			await expect(page.locator('h1').first(),route).toBeVisible();
			await expectNoHorizontalOverflow(page);
		}
	}
});
